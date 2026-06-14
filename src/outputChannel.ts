import * as vscode from "vscode";

export type OutputChannel = vscode.OutputChannel;

let channel: vscode.OutputChannel | undefined;

export function getOutputChannel(): OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel("Foundry Agent Trace");
  }
  return channel;
}

export function disposeOutputChannel(): void {
  channel?.dispose();
  channel = undefined;
}
