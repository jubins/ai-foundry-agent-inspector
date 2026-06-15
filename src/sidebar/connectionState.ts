import * as vscode from "vscode";
import { EventEmitter } from "vscode";

export interface AgentSummary {
  id: string;
  name: string;
}

export interface ConversationSummary {
  id: string;          // conv_...
  label: string;       // short display label
  createdAt?: number;  // unix seconds
}

export interface ResponseSummary {
  id: string;          // resp_...
  status?: string;
  model?: string;
  createdAt?: number;
}

export type ConnectionStatus = "unconfigured" | "connecting" | "connected" | "error";

export interface ConnectionState {
  status: ConnectionStatus;
  errorMessage?: string;
  agents: AgentSummary[];
  conversations: ConversationSummary[];
  responses: ResponseSummary[];
}

const _onDidChange = new EventEmitter<void>();
export const onDidChangeConnection = _onDidChange.event;

let _state: ConnectionState = {
  status: "unconfigured",
  agents: [],
  conversations: [],
  responses: [],
};

export function getConnectionState(): ConnectionState {
  return _state;
}

export function setConnectionState(next: Partial<ConnectionState>): void {
  _state = { ..._state, ...next };
  _onDidChange.fire();
}

export function isConfigured(context: vscode.ExtensionContext): boolean {
  const cfg = vscode.workspace.getConfiguration("aiFoundryAgentInspector");
  const endpoint = cfg.get<string>("projectEndpoint", "").trim();
  return endpoint.length > 0;
}
