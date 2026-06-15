import * as vscode from "vscode";
import { getOutputChannel, disposeOutputChannel } from "./outputChannel";
import { connectToProject } from "./commands/connect";
import { listRecentRuns } from "./commands/listRuns";
import { setApiKey, clearApiKey } from "./commands/apiKey";
import { showTrace } from "./commands/showTrace";
import { openOnboardingPanel } from "./sidebar/onboardingPanel";
import { FoundryTreeProvider, loadConnectionData } from "./sidebar/foundryTreeProvider";
import type { ConversationSummary, ResponseSummary } from "./sidebar/connectionState";

export function activate(context: vscode.ExtensionContext): void {
  const out = getOutputChannel();
  const { secrets } = context;

  // ── Sidebar tree ───────────────────────────────────────────────────────────
  const treeProvider = new FoundryTreeProvider(context);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("foundryInspector.sidebar", treeProvider)
  );

  // Auto-load on activation if already configured
  loadConnectionData(context, out).catch(() => {});

  // ── Sidebar commands ───────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("foundryInspector.openOnboarding", () => {
      openOnboardingPanel(context);
    }),

    vscode.commands.registerCommand("foundryInspector.refresh", async () => {
      await vscode.window.withProgress(
        { location: { viewId: "foundryInspector.sidebar" }, title: "Refreshing…" },
        () => loadConnectionData(context, out)
      );
    }),

    vscode.commands.registerCommand("foundryInspector.silentRefresh", () =>
      loadConnectionData(context, out, true)
    ),

    vscode.commands.registerCommand(
      "foundryInspector.openConversation",
      (conv: ConversationSummary) => {
        showTrace(context, secrets, out, { conversationId: conv.id });
      }
    ),

    vscode.commands.registerCommand(
      "foundryInspector.openResponse",
      (resp: ResponseSummary) => {
        showTrace(context, secrets, out, { responseId: resp.id });
      }
    ),

    vscode.commands.registerCommand("foundryInspector.addConversation", async () => {
      const convId = await vscode.window.showInputBox({
        title: "Add Conversation ID",
        prompt: "Paste a conversation ID from the Foundry portal",
        placeHolder: "conv_abc123…",
        ignoreFocusOut: true,
        validateInput: (v) => {
          if (!v.trim()) { return "Enter a conversation ID"; }
          if (!v.trim().startsWith("conv_")) { return "Conversation IDs start with conv_"; }
          return undefined;
        },
      });
      if (!convId) { return; }
      const trimmed = convId.trim();
      const current = vscode.workspace
        .getConfiguration("aiFoundryAgentInspector")
        .get<string[]>("conversationIds", []);
      if (!current.includes(trimmed)) {
        await vscode.workspace
          .getConfiguration("aiFoundryAgentInspector")
          .update("conversationIds", [...current, trimmed], vscode.ConfigurationTarget.Global);
        await loadConnectionData(context, out, true);
      }
    }),

    vscode.commands.registerCommand("foundryInspector.deleteResponse", async (treeItem: { data?: ResponseSummary; id?: string }) => {
      // VS Code passes the FoundryTreeItem; the ResponseSummary is on .data
      const id = treeItem?.data?.id ?? (treeItem as unknown as ResponseSummary)?.id;
      if (!id) { return; }
      const current = vscode.workspace
        .getConfiguration("aiFoundryAgentInspector")
        .get<string[]>("responseIds", []);
      await vscode.workspace
        .getConfiguration("aiFoundryAgentInspector")
        .update("responseIds", current.filter(r => r !== id), vscode.ConfigurationTarget.Global);
      await loadConnectionData(context, out, true);
    }),

    vscode.commands.registerCommand("foundryInspector.addResponse", async () => {
      const respId = await vscode.window.showInputBox({
        title: "Add Response ID",
        prompt: "Paste a response ID from the Foundry portal Traces tab",
        placeHolder: "resp_abc123…",
        ignoreFocusOut: true,
        validateInput: (v) => {
          if (!v.trim()) { return "Enter a response ID"; }
          if (!v.trim().startsWith("resp_")) { return "Response IDs start with resp_"; }
          return undefined;
        },
      });
      if (!respId) { return; }
      const trimmed = respId.trim();
      const current = vscode.workspace
        .getConfiguration("aiFoundryAgentInspector")
        .get<string[]>("responseIds", []);
      if (!current.includes(trimmed)) {
        await vscode.workspace
          .getConfiguration("aiFoundryAgentInspector")
          .update("responseIds", [...current, trimmed], vscode.ConfigurationTarget.Global);
        await loadConnectionData(context, out, true);
      }
    })
  );

  // ── Legacy commands (still reachable from command palette) ─────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("foundryTrace.connect", () =>
      connectToProject(secrets, out)
    ),
    vscode.commands.registerCommand("foundryTrace.listRuns", () =>
      listRecentRuns(secrets, out)
    ),
    vscode.commands.registerCommand("foundryTrace.setApiKey", () =>
      setApiKey(secrets)
    ),
    vscode.commands.registerCommand("foundryTrace.clearApiKey", () =>
      clearApiKey(secrets)
    ),
    vscode.commands.registerCommand("foundryTrace.showTrace", () =>
      showTrace(context, secrets, out)
    )
  );
}

export function deactivate(): void {
  disposeOutputChannel();
}
