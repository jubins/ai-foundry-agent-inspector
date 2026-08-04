// Public API for foundry-trace-inspector-core.

export type { AuthMethod, FoundryConfig } from "./config";
export type { Logger } from "./logger";
export { noopLogger } from "./logger";

export { createClient } from "./client";
export { buildOpenAIClient } from "./openaiClient";

export {
  openFoundryOpenAI,
  fetchResponsesTrace,
  fetchConversationTrace,
  type FetchOptions,
} from "./fetch";

export {
  normalizeFromResponses,
  normalizeFromConversationItems,
  normalizeFromThreads,
  type ResponseMeta,
} from "./trace/normalizer";

export type {
  StepKind,
  MessageRole,
  StepStatus,
  TokenUsage,
  ToolCallStep,
  LlmStep,
  MessageStep,
  TraceStep,
  TraceSession,
  TraceAgent,
} from "./trace/model";
