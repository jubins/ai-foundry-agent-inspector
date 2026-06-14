import * as vscode from "vscode";
import { storeApiKey, deleteApiKey } from "../config";

export async function setApiKey(secrets: vscode.SecretStorage): Promise<void> {
  const key = await vscode.window.showInputBox({
    title: "Foundry Trace: Set API Key",
    prompt: "Enter your Azure AI Foundry project API key",
    password: true,
    ignoreFocusOut: true,
    placeHolder: "Paste your API key here",
  });

  if (!key) {
    return;
  }

  await storeApiKey(secrets, key.trim());
  vscode.window.showInformationMessage(
    "Foundry Trace: API key stored securely in VS Code SecretStorage."
  );
}

export async function clearApiKey(
  secrets: vscode.SecretStorage
): Promise<void> {
  const confirm = await vscode.window.showWarningMessage(
    "Clear the stored Foundry API key?",
    { modal: true },
    "Clear"
  );
  if (confirm !== "Clear") {
    return;
  }

  await deleteApiKey(secrets);
  vscode.window.showInformationMessage(
    "Foundry Trace: API key removed from SecretStorage."
  );
}
