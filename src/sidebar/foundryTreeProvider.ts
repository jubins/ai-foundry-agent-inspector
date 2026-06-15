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

  private _selectedConvId: string | undefined;
  private _treeView: vscode.TreeView<FoundryTreeItem> | undefined;
  // Cache vended items so reveal() can find the exact same object instance
  private _responseItemCache = new Map<string, FoundryTreeItem>();
  private _sectionResponsesItem: FoundryTreeItem | undefined;

  get selectedConvId(): string | undefined { return this._selectedConvId; }

  setTreeView(view: vscode.TreeView<FoundryTreeItem>): void {
    this._treeView = view;
  }

  revealResponseId(responseId: string): void {
    if (!this._treeView) { return; }
    const cached = this._responseItemCache.get(responseId);
    if (!cached) { return; }
    this._treeView.reveal(cached, { select: true, focus: false, expand: true });
  }

  // Required by TreeView.reveal() for non-root items
  getParent(element: FoundryTreeItem): FoundryTreeItem | undefined {
    if (element.kind === "response" || element.kind === "hint" || element.kind === "action") {
      return this._sectionResponsesItem;
    }
    if (element.kind === "conversation") {
      return undefined; // conversations are under a section but we return undefined to keep it simple
    }
    return undefined;
  }

  constructor(private readonly context: vscode.ExtensionContext) {
    onDidChangeConnection(() => this._onDidChangeTreeData.fire());
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("aiFoundryAgentInspector")) {
        this._onDidChangeTreeData.fire();
      }
    }, null, context.subscriptions);
  }

  selectConversation(convId: string | undefined): void {
    this._selectedConvId = convId || undefined;
    this._onDidChangeTreeData.fire();
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

    const filteredResponses = this._selectedConvId
      ? state.responses.filter(r => r.conversationId === this._selectedConvId)
      : state.responses;

    const respSection = new FoundryTreeItem(
      "Responses",
      "section-responses",
      vscode.TreeItemCollapsibleState.Expanded
    );
    respSection.description = this._selectedConvId
      ? `${filteredResponses.length} of ${state.responses.length}`
      : `${state.responses.length}`;
    respSection.iconPath = new vscode.ThemeIcon("list-unordered");
    respSection.contextValue = "section-responses";
    respSection.tooltip = this._selectedConvId
      ? `Showing responses for selected conversation. Click a different conversation to filter, or click the same one again to clear.`
      : "All tracked responses. Click a conversation above to filter.";

    this._sectionResponsesItem = respSection;
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
      const isSelected = this._selectedConvId === conv.id;
      const item = new FoundryTreeItem(
        conv.label,
        "conversation",
        vscode.TreeItemCollapsibleState.None,
        conv
      );
      item.description = conv.createdAt
        ? new Date(conv.createdAt * 1000).toLocaleString()
        : conv.id.slice(0, 24) + "…";
      item.iconPath = new vscode.ThemeIcon(isSelected ? "comment-discussion" : "comment-discussion");
      item.tooltip = `${conv.id}\n${isSelected ? "Selected — Responses filtered below. Click again to clear." : "Click to filter Responses, click again to open timeline"}`;
      item.contextValue = "conversation";
      item.command = {
        command: "foundryInspector.selectConversation",
        title: "Select Conversation",
        arguments: [conv],
      };
      return item;
    });
  }

  // ── Responses ────────────────────────────────────────────────────────────────

  private _responseItems(): FoundryTreeItem[] {
    const { responses } = getConnectionState();
    const visible = this._selectedConvId
      ? responses.filter(r => r.conversationId === this._selectedConvId)
      : responses;

    // Rebuild cache so revealResponseId() can find the exact vended instances
    this._responseItemCache.clear();

    if (visible.length === 0 && responses.length === 0) {
      const hint = new FoundryTreeItem(
        "No responses tracked yet",
        "hint",
        vscode.TreeItemCollapsibleState.None
      );
      hint.iconPath = new vscode.ThemeIcon("info");
      hint.tooltip =
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

      return [hint, addItem];
    }

    const items = visible.map((resp) => {
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
      this._responseItemCache.set(resp.id, item);
      return item;
    });

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
  out: vscode.OutputChannel,
  silent = false
): Promise<void> {
  const cfg = getConfig();
  if (!cfg.projectEndpoint) {
    setConnectionState({ status: "unconfigured" });
    return;
  }

  // Only show "connecting" spinner on initial/explicit refresh — not on silent sidebar updates
  if (!silent) { setConnectionState({ status: "connecting" }); }

  try {
    const apiKey = cfg.authMethod === "apiKey"
      ? await getApiKey(context.secrets)
      : undefined;

    const client = createClient(cfg, apiKey);
    const openai = buildOpenAIClient(cfg.projectEndpoint, apiKey);

    // Load agents — best-effort, don't let failure abort response hydration
    const agents: Array<{ id: string; name: string }> = [];
    try {
      for await (const agent of client.agents.list()) {
        const a = agent as unknown as { id?: string; name?: string; display_name?: string };
        agents.push({ id: a.id ?? "", name: a.display_name ?? a.name ?? "Agent" });
      }
    } catch (err) {
      out.appendLine(`Could not list agents (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
    }

    // Hydrate saved response IDs
    const savedIds = cfg.responseIds;
    const responses: ResponseSummary[] = [];
    const convMap = new Map<string, ConversationSummary>();

    for (const id of savedIds) {
      try {
        const resp = await openai.responses.retrieve(id);
        const convId = resp.conversation?.id;
        responses.push({
          id: resp.id,
          status: resp.status ?? undefined,
          model: resp.model,
          createdAt: resp.created_at,
          conversationId: convId,
        });

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
