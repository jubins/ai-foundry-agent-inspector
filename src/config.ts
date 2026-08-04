import * as vscode from "vscode";
import type { AuthMethod, FoundryConfig } from "foundry-trace-inspector-core";

// Config shape lives in the shared core package; re-export it so existing
// extension imports (`from "../config"`) keep working unchanged.
export type { AuthMethod, FoundryConfig };

const SECRET_KEY = "aiFoundryAgentInspector.apiKey";

export function getConfig(): FoundryConfig {
  const cfg = vscode.workspace.getConfiguration("aiFoundryAgentInspector");
  return {
    projectEndpoint: cfg.get<string>("projectEndpoint", "").trim(),
    authMethod: cfg.get<AuthMethod>("authMethod", "entraId"),
    maxRunsToList: cfg.get<number>("maxRunsToList", 20),
    responseIds: cfg.get<string[]>("responseIds", []),
    conversationIds: cfg.get<string[]>("conversationIds", []),
  };
}

export async function getApiKey(
  secrets: vscode.SecretStorage
): Promise<string | undefined> {
  return secrets.get(SECRET_KEY);
}

export async function storeApiKey(
  secrets: vscode.SecretStorage,
  key: string
): Promise<void> {
  await secrets.store(SECRET_KEY, key);
}

export async function deleteApiKey(
  secrets: vscode.SecretStorage
): Promise<void> {
  await secrets.delete(SECRET_KEY);
}
