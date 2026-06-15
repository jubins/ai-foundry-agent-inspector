import * as vscode from "vscode";
import OpenAI from "openai";
import { createClient } from "../client";
import { getConfig, getApiKey } from "../config";
import { normalizeFromResponses } from "../trace/normalizer";
import { showTracePanel } from "../webview/tracePanel";
import type { OutputChannel } from "../outputChannel";
import type { AIProjectClient } from "@azure/ai-projects";

export async function showTrace(
  context: vscode.ExtensionContext,
  secrets: vscode.SecretStorage,
  out: OutputChannel
): Promise<void> {
  const config = getConfig();

  if (!config.projectEndpoint) {
    const action = await vscode.window.showErrorMessage(
      "No Foundry project endpoint configured.",
      "Open Settings"
    );
    if (action === "Open Settings") {
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "aiFoundryAgentInspector"
      );
    }
    return;
  }

  // Build a QuickPick from saved IDs + option to add new ones
  const responseIds = await pickResponseIds(config.responseIds);
  if (!responseIds) { return; }

  // Save back to settings so next time they appear pre-checked
  await vscode.workspace
    .getConfiguration("aiFoundryAgentInspector")
    .update("responseIds", responseIds, vscode.ConfigurationTarget.Global);

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
