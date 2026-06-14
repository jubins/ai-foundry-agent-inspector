import * as vscode from "vscode";
import { createClient } from "../client";
import { getConfig, getApiKey } from "../config";
import type { OutputChannel } from "../outputChannel";

export async function listRecentRuns(
  secrets: vscode.SecretStorage,
  out: OutputChannel
): Promise<void> {
  const config = getConfig();

  if (!config.projectEndpoint) {
    vscode.window.showErrorMessage(
      "No Foundry project endpoint configured. Set aiFoundryAgentInspector.projectEndpoint in your VS Code settings."
    );
    return;
  }

  out.show();
  out.appendLine(`\n${"=".repeat(60)}`);
  out.appendLine(`Foundry Trace: List Recent Runs`);
  out.appendLine(`Endpoint: ${config.projectEndpoint}`);

  try {
    const apiKey =
      config.authMethod === "apiKey" ? await getApiKey(secrets) : undefined;
    const client = createClient(config, apiKey);

    // ── Foundry Agents (new data-plane model) ───────────────────────────────
    // Lists "agents" defined in this Foundry project.
    out.appendLine("\n--- Foundry Agents ---");
    const agents: unknown[] = [];
    for await (const agent of client.agents.list()) {
      agents.push(agent);
    }
    out.appendLine(
      `Found ${agents.length} agent(s):\n${JSON.stringify(agents, null, 2)}`
    );

    // ── Beta Sessions (hosted-agent sessions / "runs") ───────────────────────
    // For hosted Foundry agents, sessions are the equivalent of "runs".
    // We list sessions for each agent to capture trace data.
    const agentList = agents as Array<{ name?: string }>;
    for (const agent of agentList.slice(0, 3)) {
      const agentName = agent?.name;
      if (!agentName) {
        continue;
      }

      out.appendLine(`\n--- Sessions for agent "${agentName}" ---`);
      const sessions: unknown[] = [];
      for await (const session of client.beta.agents.listSessions(agentName)) {
        sessions.push(session);
        if (sessions.length >= config.maxRunsToList) {
          break;
        }
      }
      out.appendLine(
        `Found ${sessions.length} session(s):\n${JSON.stringify(sessions, null, 2)}`
      );
    }

    // ── Connections (useful for understanding auth to downstream services) ───
    out.appendLine("\n--- Connections ---");
    const connections: unknown[] = [];
    for await (const conn of client.connections.list()) {
      connections.push(conn);
    }
    out.appendLine(
      `Found ${connections.length} connection(s):\n${JSON.stringify(connections, null, 2)}`
    );

    vscode.window.showInformationMessage(
      `Foundry Trace: Fetched data for ${agents.length} agent(s). ` +
        `Check the "Foundry Agent Trace" Output channel for raw JSON.`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    out.appendLine(`\nError: ${message}`);
    if (err instanceof Error && err.stack) {
      out.appendLine(err.stack);
    }
    vscode.window.showErrorMessage(
      `Foundry Trace: Failed to list runs — ${message}`
    );
  }
}
