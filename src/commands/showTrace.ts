import * as vscode from "vscode";
import OpenAI from "openai";
import { createClient } from "../client";
import { getConfig, getApiKey } from "../config";
import { normalizeFromResponses, normalizeFromConversationItems } from "../trace/normalizer";
import type { ResponseMeta } from "../trace/normalizer";
import { showTracePanel } from "../webview/tracePanel";
import type { OutputChannel } from "../outputChannel";
import type { AIProjectClient } from "@azure/ai-projects";

export interface ShowTraceOptions {
  responseId?: string;       // pre-selected from sidebar
  conversationId?: string;   // pre-selected from sidebar (future: conv flow)
}

export async function showTrace(
  context: vscode.ExtensionContext,
  secrets: vscode.SecretStorage,
  out: OutputChannel,
  options?: ShowTraceOptions
): Promise<void> {
  const config = getConfig();

  if (!config.projectEndpoint) {
    const action = await vscode.window.showErrorMessage(
      "No Foundry project endpoint configured.",
      "Configure Now"
    );
    if (action === "Configure Now") {
      await vscode.commands.executeCommand("foundryInspector.openOnboarding");
    }
    return;
  }

  // Conversation flow: fetch all items in a conversation
  if (options?.conversationId) {
    const convId = options.conversationId;
    const fetchAndShowConv = async (): Promise<void> => {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Fetching conversation ${convId.slice(0, 20)}…`, cancellable: false },
        async () => {
          try {
            const apiKey = config.authMethod === "apiKey" ? await getApiKey(secrets) : undefined;
            const client = createClient(config, apiKey);
            const openai = buildOpenAIClient(config.projectEndpoint, apiKey, client);
            const items: OpenAI.Conversations.ConversationItem[] = [];
            for await (const item of await openai.conversations.items.list(convId, { order: "asc" })) {
              items.push(item);
            }
            out.appendLine(`Conversation ${convId}: ${items.length} items`);

            // Collect unique response IDs from assistant messages to hydrate metadata
            const responseIds = new Set<string>();
            for (const item of items) {
              const raw = item as unknown as { created_by?: { response_id?: string } };
              if (raw.created_by?.response_id) { responseIds.add(raw.created_by.response_id); }
            }

            // Fetch response metadata in parallel (model, tokens, timing)
            const responseMetas = new Map<string, ResponseMeta>();
            await Promise.all([...responseIds].map(async (rid) => {
              try {
                const resp = await openai.responses.retrieve(rid);
                responseMetas.set(rid, {
                  id: rid,
                  model: resp.model,
                  status: resp.status ?? undefined,
                  createdAt: resp.created_at,
                  tokenUsage: resp.usage ? {
                    input: resp.usage.input_tokens,
                    output: resp.usage.output_tokens,
                    total: resp.usage.input_tokens + resp.usage.output_tokens,
                  } : undefined,
                });
              } catch { /* metadata fetch is best-effort */ }
            }));

            const traceAgents = normalizeFromConversationItems(convId, items, responseMetas);
            showTracePanel(context, traceAgents, fetchAndShowConv);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            out.appendLine(`Conversation fetch error: ${message}`);
            vscode.window.showErrorMessage(`Could not fetch conversation: ${message}`);
          }
        }
      );
    };
    await fetchAndShowConv();
    return;
  }

  // If called from sidebar with a known response ID, use it directly
  let responseIds: string[];
  if (options?.responseId) {
    responseIds = [options.responseId];
  } else {
    // Interactive QuickPick
    const picked = await pickResponseIds(config.responseIds);
    if (!picked) { return; }
    responseIds = picked;
    // Save back to settings so next time they appear pre-checked
    await vscode.workspace
      .getConfiguration("aiFoundryAgentInspector")
      .update("responseIds", responseIds, vscode.ConfigurationTarget.Global);
  }

  const fetchAndShow = async (): Promise<void> => {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Foundry Trace: Fetching trace data…",
        cancellable: false,
      },
      async (progress) => {
        try {
          const apiKey =
            config.authMethod === "apiKey" ? await getApiKey(secrets) : undefined;
          const client = createClient(config, apiKey);
          const openai = buildOpenAIClient(config.projectEndpoint, apiKey, client);

          // Fetch each response by ID
          const responses: OpenAI.Responses.Response[] = [];
          for (const id of responseIds) {
            progress.report({ message: `Fetching ${id}…` });
            try {
              const resp = await openai.responses.retrieve(id);
              responses.push(resp);
              out.appendLine(`Fetched response ${id}: status=${resp.status}, output items=${resp.output?.length ?? 0}`);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              out.appendLine(`Could not fetch response ${id}: ${msg}`);
              vscode.window.showWarningMessage(`Could not fetch response ${id}: ${msg}`);
            }
          }

          if (responses.length === 0) {
            vscode.window.showErrorMessage("No responses could be fetched. Check the response IDs and try again.");
            return;
          }

          out.appendLine(`\nRaw response data:\n${JSON.stringify(responses, null, 2)}`);

          const traceAgents = normalizeFromResponses(responses);
          showTracePanel(context, traceAgents, fetchAndShow);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          out.appendLine(`Show Trace error: ${message}`);
          if (err instanceof Error && err.stack) { out.appendLine(err.stack); }
          vscode.window.showErrorMessage(`Foundry Trace: ${message}`);
        }
      }
    );
  };

  await fetchAndShow();
}

const ADD_NEW_LABEL = "$(add) Add new response ID…";
const MANAGE_LABEL = "$(trash) Remove response IDs…";

async function pickResponseIds(saved: string[]): Promise<string[] | undefined> {
  while (true) {
    const items: vscode.QuickPickItem[] = [
      ...saved.map((id) => ({
        label: id,
        description: "saved",
        picked: true,
      })),
      { label: "", kind: vscode.QuickPickItemKind.Separator },
      { label: ADD_NEW_LABEL, description: "Paste a new resp_... ID" },
      ...(saved.length > 0
        ? [{ label: MANAGE_LABEL, description: "Remove saved IDs" }]
        : []),
    ];

    const picks = await vscode.window.showQuickPick(items, {
      title: "Foundry Trace: Select Response IDs to fetch",
      placeHolder: saved.length === 0
        ? "No saved IDs yet — choose 'Add new' to paste one"
        : "Space to toggle, Enter to confirm",
      canPickMany: true,
      ignoreFocusOut: true,
      matchOnDescription: true,
    });

    if (!picks) { return undefined; }

    if (picks.some((p) => p.label === ADD_NEW_LABEL)) {
      const newId = await vscode.window.showInputBox({
        title: "Foundry Trace: Add Response ID",
        prompt: "Paste a response ID from the Foundry portal Traces tab",
        placeHolder: "resp_abc123...",
        ignoreFocusOut: true,
        validateInput: (v) => {
          if (!v.trim()) { return "Enter a response ID"; }
          if (!v.trim().startsWith("resp_")) { return "Response IDs start with resp_"; }
          return undefined;
        },
      });
      if (newId) {
        const trimmed = newId.trim();
        if (!saved.includes(trimmed)) { saved = [...saved, trimmed]; }
        // Save immediately so the QuickPick reopens with the new ID
        await vscode.workspace
          .getConfiguration("aiFoundryAgentInspector")
          .update("responseIds", saved, vscode.ConfigurationTarget.Global);
      }
      continue; // reopen QuickPick with new list
    }

    if (picks.some((p) => p.label === MANAGE_LABEL)) {
      const toRemove = await vscode.window.showQuickPick(
        saved.map((id) => ({ label: id })),
        {
          title: "Foundry Trace: Remove Saved Response IDs",
          placeHolder: "Select IDs to remove",
          canPickMany: true,
          ignoreFocusOut: true,
        }
      );
      if (toRemove && toRemove.length > 0) {
        const removeSet = new Set(toRemove.map((p) => p.label));
        saved = saved.filter((id) => !removeSet.has(id));
        await vscode.workspace
          .getConfiguration("aiFoundryAgentInspector")
          .update("responseIds", saved, vscode.ConfigurationTarget.Global);
      }
      continue; // reopen QuickPick
    }

    // Normal selection — return the IDs of the picked items (skip separators/actions)
    const selected = picks
      .map((p) => p.label)
      .filter((l) => l && !l.startsWith("$("));

    if (selected.length === 0) {
      vscode.window.showWarningMessage("Select at least one response ID.");
      continue;
    }

    return selected;
  }
}

function buildOpenAIClient(
  endpoint: string,
  apiKey: string | undefined,
  client: AIProjectClient
): OpenAI {
  const baseURL = `${endpoint.replace(/\/$/, "")}/openai/v1`;
  if (apiKey) {
    return new OpenAI({
      apiKey,
      baseURL,
      defaultHeaders: { "api-key": apiKey },
      dangerouslyAllowBrowser: true,
    });
  }
  return client.getOpenAIClient();
}
