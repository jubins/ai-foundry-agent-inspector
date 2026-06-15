import * as vscode from "vscode";
import {
  getConnectionState,
  onDidChangeConnection,
  setConnectionState,
  isConfigured,
  type ConversationSummary,
  type ResponseSummary,
} from "./connectionState";
import { getConfig, getApiKey } from "../config";
import { createClient } from "../client";
import OpenAI from "openai";

// ── Tree item kinds ───────────────────────────────────────────────────────────

type ItemKind =
  | "unconfigured"
  | "connecting"
  | "error"
  | "section-conversations"
  | "section-responses"
  | "conversation"
  | "response"
  | "empty"
  | "action"
  | "hint";

export class FoundryTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly kind: ItemKind,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly data?: ConversationSummary | ResponseSummary
  ) {
    super(label, collapsibleState);
  }
}

// ── Provider ─────────────────────────────────────────────────────────────────

export class FoundryTreeProvider
  implements vscode.TreeDataProvider<FoundryTreeItem>
{
  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<FoundryTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly context: vscode.ExtensionContext) {
    onDidChangeConnection(() => this._onDidChangeTreeData.fire());
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("aiFoundryAgentInspector")) {
        this._onDidChangeTreeData.fire();
      }
    }, null, context.subscriptions);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: FoundryTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: FoundryTreeItem): FoundryTreeItem[] {
    if (!element) {
      return this._rootItems();
    }
    if (element.kind === "section-conversations") {
      return this._conversationItems();
    }
    if (element.kind === "section-responses") {
      return this._responseItems();
    }
    return [];
  }

  // ── Root ────────────────────────────────────────────────────────────────────

  private _rootItems(): FoundryTreeItem[] {
    const state = getConnectionState();

    if (!isConfigured(this.context)) {
      const item = new FoundryTreeItem(
        "Click ⚙ to configure your project",
        "unconfigured",
        vscode.TreeItemCollapsibleState.None
      );
      item.description = "Not configured";
      item.iconPath = new vscode.ThemeIcon("warning");
      item.command = { command: "foundryInspector.openOnboarding", title: "Configure" };
      return [item];
    }

    if (state.status === "connecting") {
      const item = new FoundryTreeItem(
        "Connecting…",
        "connecting",
        vscode.TreeItemCollapsibleState.None
      );
      item.iconPath = new vscode.ThemeIcon("loading~spin");
      return [item];
    }

    if (state.status === "error") {
      const errItem = new FoundryTreeItem(
        "Connection failed",
        "error",
        vscode.TreeItemCollapsibleState.None
      );
      errItem.description = state.errorMessage ?? "Unknown error";
      errItem.iconPath = new vscode.ThemeIcon("error");
      errItem.tooltip = state.errorMessage;

      const retryItem = new FoundryTreeItem(
        "Retry connection",
        "action",
        vscode.TreeItemCollapsibleState.None
      );
      retryItem.iconPath = new vscode.ThemeIcon("refresh");
      retryItem.command = { command: "foundryInspector.refresh", title: "Retry" };
      return [errItem, retryItem];
    }

    if (state.status === "unconfigured") {
      const item = new FoundryTreeItem(
        "Click ⚙ to configure your project",
        "unconfigured",
        vscode.TreeItemCollapsibleState.None
      );
      item.iconPath = new vscode.ThemeIcon("info");
      item.command = { command: "foundryInspector.openOnboarding", title: "Configure" };
      return [item];
    }

    // Connected — show sections
    const convSection = new FoundryTreeItem(
      "Conversations",
      "section-conversations",
      vscode.TreeItemCollapsibleState.Expanded
    );
    convSection.description = `${state.conversations.length}`;
    convSection.iconPath = new vscode.ThemeIcon("comment-discussion");
    convSection.contextValue = "section-conversations";
    convSection.tooltip = "Conversations tracked from your Foundry project. Click + to add a conversation ID.";

    const respSection = new FoundryTreeItem(
      "Responses",
      "section-responses",
      vscode.TreeItemCollapsibleState.Expanded
    );
    respSection.description = `${state.responses.length}`;
    respSection.iconPath = new vscode.ThemeIcon("list-unordered");
    respSection.contextValue = "section-responses";
    respSection.tooltip = "Individual response traces. Click + to add a response ID (resp_...) from the Foundry portal.";

    return [convSection, respSection];
  }

  // ── Conversations ────────────────────────────────────────────────────────────

  private _conversationItems(): FoundryTreeItem[] {
    const { conversations } = getConnectionState();

    if (conversations.length === 0) {
      const hint1 = new FoundryTreeItem(
        "No conversations tracked yet",
        "hint",
        vscode.TreeItemCollapsibleState.None
      );
      hint1.iconPath = new vscode.ThemeIcon("info");
      hint1.tooltip =
        "Conversations are automatically discovered from your tracked responses. " +
        "Add a response ID (resp_...) via the + button on the Responses section, " +
        "or add a conversation ID (conv_...) directly with the + button above.";

      const addItem = new FoundryTreeItem(
        "Add conversation ID…",
        "action",
        vscode.TreeItemCollapsibleState.None
      );
      addItem.iconPath = new vscode.ThemeIcon("add");
      addItem.description = "conv_...";
      addItem.tooltip = "Paste a conversation ID from the Foundry portal";
      addItem.command = { command: "foundryInspector.addConversation", title: "Add Conversation ID" };

      return [hint1, addItem];
    }

    return conversations.map((conv) => {
      const item = new FoundryTreeItem(
        conv.label,
        "conversation",
        vscode.TreeItemCollapsibleState.None,
        conv
      );
      item.description = conv.createdAt
        ? new Date(conv.createdAt * 1000).toLocaleString()
        : conv.id.slice(0, 24) + "…";
      item.iconPath = new vscode.ThemeIcon("comment-discussion");
      item.tooltip = `${conv.id}\nClick to view full conversation timeline`;
      item.contextValue = "conversation";
      item.command = {
        command: "foundryInspector.openConversation",
        title: "Open Conversation",
        arguments: [conv],
      };
      return item;
    });
  }

  // ── Responses ────────────────────────────────────────────────────────────────

  private _responseItems(): FoundryTreeItem[] {
    const { responses } = getConnectionState();

    if (responses.length === 0) {
      const hint1 = new FoundryTreeItem(
        "No responses tracked yet",
        "hint",
        vscode.TreeItemCollapsibleState.None
      );
      hint1.iconPath = new vscode.ThemeIcon("info");
      hint1.tooltip =
        "A response ID (resp_...) represents a single agent turn. " +
        "Find it in the Foundry portal → your agent → Traces tab. " +
        "Click the + button above to add one.";

      const addItem = new FoundryTreeItem(
        "Add response ID…",
        "action",
        vscode.TreeItemCollapsibleState.None
      );
      addItem.iconPath = new vscode.ThemeIcon("add");
      addItem.description = "resp_...";
      addItem.tooltip = "Paste a response ID from the Foundry portal Traces tab";
      addItem.command = { command: "foundryInspector.addResponse", title: "Add Response ID" };

      return [hint1, addItem];
    }

    const items = responses.map((resp) => {
      const shortId = resp.id.length > 24 ? resp.id.slice(0, 24) + "…" : resp.id;
      const item = new FoundryTreeItem(
        shortId,
        "response",
        vscode.TreeItemCollapsibleState.None,
        resp
      );
      const statusLabel = resp.status ?? "unknown";
      const modelLabel = resp.model ? ` · ${resp.model}` : "";
      item.description = `${statusLabel}${modelLabel}`;
      item.iconPath = new vscode.ThemeIcon(
        resp.status === "completed" ? "pass-filled" :
        resp.status === "failed"    ? "error" :
        "circle-outline"
      );
      item.tooltip =
        `ID: ${resp.id}\nStatus: ${statusLabel}\nModel: ${resp.model ?? "?"}\n` +
        (resp.createdAt ? `Created: ${new Date(resp.createdAt * 1000).toLocaleString()}\n` : "") +
        `\nClick to view trace timeline`;
      item.contextValue = "response";
      item.command = {
        command: "foundryInspector.openResponse",
        title: "Open Response",
        arguments: [resp],
      };
      return item;
    });

    // Always add an "Add more" item at the bottom
    const addItem = new FoundryTreeItem(
      "Add response ID…",
      "action",
      vscode.TreeItemCollapsibleState.None
    );
    addItem.iconPath = new vscode.ThemeIcon("add");
    addItem.description = "resp_...";
    addItem.command = { command: "foundryInspector.addResponse", title: "Add Response ID" };

    return [...items, addItem];
  }
}

// ── Connection loader ────────────────────────────────────────────────────────

export async function loadConnectionData(
  context: vscode.ExtensionContext,
  out: vscode.OutputChannel
): Promise<void> {
  const cfg = getConfig();
  if (!cfg.projectEndpoint) {
    setConnectionState({ status: "unconfigured" });
    return;
  }

  setConnectionState({ status: "connecting" });

  try {
    const apiKey = cfg.authMethod === "apiKey"
      ? await getApiKey(context.secrets)
      : undefined;

    const client = createClient(cfg, apiKey);
    const openai = buildOpenAIClient(cfg.projectEndpoint, apiKey);

    // Load agents (for context / future use)
    const agents: Array<{ id: string; name: string }> = [];
    for await (const agent of client.agents.list()) {
      const a = agent as unknown as { id?: string; name?: string; display_name?: string };
      agents.push({ id: a.id ?? "", name: a.display_name ?? a.name ?? "Agent" });
    }

    // Hydrate saved response IDs
    const savedIds = cfg.responseIds;
    const responses: ResponseSummary[] = [];
    const convMap = new Map<string, ConversationSummary>();

    for (const id of savedIds) {
      try {
        const resp = await openai.responses.retrieve(id);
        responses.push({
          id: resp.id,
          status: resp.status ?? undefined,
          model: resp.model,
          createdAt: resp.created_at,
        });

        // Extract conversation ID from the response
        const convId = resp.conversation?.id;
        if (convId && !convMap.has(convId)) {
          convMap.set(convId, {
            id: convId,
            label: convId.slice(0, 16) + "…",
            createdAt: resp.created_at,
          });
          out.appendLine(`Discovered conversation ${convId} from response ${id}`);
        }
      } catch (err) {
        out.appendLine(`Could not hydrate response ${id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Also add manually saved conversation IDs from settings
    for (const convId of cfg.conversationIds) {
      if (!convMap.has(convId)) {
        convMap.set(convId, { id: convId, label: convId.slice(0, 16) + "…" });
      }
    }

    const conversations = Array.from(convMap.values());

    setConnectionState({
      status: "connected",
      errorMessage: undefined,
      agents,
      conversations,
      responses,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    out.appendLine(`Foundry connection error: ${message}`);
    setConnectionState({ status: "error", errorMessage: message });
  }
}

function buildOpenAIClient(endpoint: string, apiKey: string | undefined): OpenAI {
  const baseURL = `${endpoint.replace(/\/$/, "")}/openai/v1`;
  if (apiKey) {
    return new OpenAI({
      apiKey,
      baseURL,
      defaultHeaders: { "api-key": apiKey },
      dangerouslyAllowBrowser: true,
    });
  }
  return new OpenAI({ apiKey: "placeholder", baseURL, dangerouslyAllowBrowser: true });
}

export type { ResponseSummary };
