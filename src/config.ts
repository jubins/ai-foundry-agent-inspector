import * as vscode from "vscode";

export type AuthMethod = "entraId" | "apiKey";

export interface FoundryConfig {
  projectEndpoint: string;
  authMethod: AuthMethod;
  maxRunsToList: number;
  responseIds: string[];
  conversationIds: string[];
}

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
