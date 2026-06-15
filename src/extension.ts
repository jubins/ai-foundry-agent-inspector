import * as vscode from "vscode";
import { getOutputChannel, disposeOutputChannel } from "./outputChannel";
import { connectToProject } from "./commands/connect";
import { listRecentRuns } from "./commands/listRuns";
import { setApiKey, clearApiKey } from "./commands/apiKey";
import { showTrace } from "./commands/showTrace";

export function activate(context: vscode.ExtensionContext): void {
  const out = getOutputChannel();
  const { secrets } = context;

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
