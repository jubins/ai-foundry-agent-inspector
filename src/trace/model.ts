// Normalized internal trace model — independent of the Foundry SDK shape.
// Phase 3 renders this; Phase 2 produces it.

export type StepKind = "llm" | "toolCall" | "message";
export type MessageRole = "user" | "assistant" | "system";
export type StepStatus = "completed" | "failed" | "in_progress" | "unknown";

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface ToolCallStep {
  kind: "toolCall";
  id: string;
  name: string;
  input: unknown;
  output: unknown;
  status: StepStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

export interface LlmStep {
  kind: "llm";
  id: string;
  model?: string;
  status: StepStatus;
  tokenUsage?: TokenUsage;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  toolCalls: ToolCallStep[];
}

export interface MessageStep {
  kind: "message";
  id: string;
  role: MessageRole;
  content: string;
  createdAt?: string;
}

export type TraceStep = LlmStep | ToolCallStep | MessageStep;

export interface TraceSession {
  id: string;
  agentName: string;
  status: StepStatus;
  createdAt?: string;
  completedAt?: string;
  totalTokens?: TokenUsage;
  steps: TraceStep[];
}

export interface TraceAgent {
  id: string;
  name: string;
  model?: string;
  version?: string;
  sessions: TraceSession[];
}
