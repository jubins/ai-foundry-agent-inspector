import * as vscode from "vscode";
import { createClient } from "../client";
import { getConfig, getApiKey } from "../config";
import type { OutputChannel } from "../outputChannel";

export async function connectToProject(
  secrets: vscode.SecretStorage,
  out: OutputChannel
): Promise<void> {
  const config = getConfig();

  if (!config.projectEndpoint) {
    const action = await vscode.window.showErrorMessage(
      "No Foundry project endpoint configured. Set aiFoundryAgentInspector.projectEndpoint in your VS Code settings.",
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

  out.show();
  out.appendLine(`Connecting to: ${config.projectEndpoint}`);
  out.appendLine(`Auth method:   ${config.authMethod}`);

  try {
    const apiKey =
      config.authMethod === "apiKey" ? await getApiKey(secrets) : undefined;
    const client = createClient(config, apiKey);

    out.appendLine("Fetching agents list as connection sanity check…");
    const agents: unknown[] = [];
    for await (const agent of client.agents.list()) {
      agents.push(agent);
    }

    out.appendLine(`\nConnection successful!`);
    out.appendLine(
      `Found ${agents.length} agent(s) in the project:\n${JSON.stringify(
        agents,
        null,
        2
      )}`
    );

    vscode.window.showInformationMessage(
      `Foundry Trace: Connected. Found ${agents.length} agent(s).`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    out.appendLine(`\nConnection failed: ${message}`);
    if (err instanceof Error && err.stack) {
      out.appendLine(err.stack);
    }
    vscode.window.showErrorMessage(`Foundry Trace: Connection failed — ${message}`);
  }
}
