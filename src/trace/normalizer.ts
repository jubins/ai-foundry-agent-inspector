import type OpenAI from "openai";
import type {
  TraceAgent,
  TraceSession,
  TraceStep,
  LlmStep,
  ToolCallStep,
  MessageStep,
  StepStatus,
  TokenUsage,
} from "./model";
import type { OutputChannel } from "../outputChannel";

// ── Helpers ──────────────────────────────────────────────────────────────────

function isoFromUnix(ts: number | null | undefined): string | undefined {
  if (!ts) { return undefined; }
  return new Date(ts * 1000).toISOString();
}

function responseStatus(s: string | null | undefined): StepStatus {
  switch (s) {
    case "completed": return "completed";
    case "failed":    return "failed";
    case "in_progress": return "in_progress";
    default: return "unknown";
  }
}

function extractText(
  content: OpenAI.Responses.ResponseOutputMessage["content"]
): string {
  if (!Array.isArray(content)) { return String(content ?? ""); }
  return content
    .map((part) => {
      if (part.type === "output_text") {
        return (part as OpenAI.Responses.ResponseOutputText).text ?? "";
      }
      if (part.type === "refusal") {
        return `[refusal: ${(part as OpenAI.Responses.ResponseOutputRefusal).refusal}]`;
      }
      return "";
    })
    .join("");
}

function extractInputText(
  input: unknown
): string {
  if (!input) { return ""; }
  if (typeof input === "string") { return input; }
  if (!Array.isArray(input)) { return ""; }
  return input
    .map((item) => {
      const i = item as { type?: string; role?: string; content?: unknown };
      if (i.type === "message" && i.role === "user") {
        if (typeof i.content === "string") { return i.content; }
        if (Array.isArray(i.content)) {
          return (i.content as Array<{ type?: string; text?: string }>)
            .filter((p) => p.type === "input_text")
            .map((p) => p.text ?? "")
            .join("");
        }
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

// ── Main export ───────────────────────────────────────────────────────────────

export function normalizeFromResponses(
  responses: OpenAI.Responses.Response[]
): TraceAgent[] {
  // Group responses by model (proxy for "agent") since we may not have
  // assistant metadata when using the Responses API directly.
  const byModel = new Map<string, OpenAI.Responses.Response[]>();
  for (const r of responses) {
    const key = r.model ?? "unknown-model";
    if (!byModel.has(key)) { byModel.set(key, []); }
    byModel.get(key)!.push(r);
  }

  const agents: TraceAgent[] = [];

  for (const [model, modelResponses] of byModel) {
    // Group by conversation (previous_response_id chain) into sessions
    const sessions = groupIntoSessions(modelResponses);

    agents.push({
      id: model,
      name: modelResponses[0] ? getAgentName(modelResponses[0]) : model,
      model,
      sessions,
    });
  }

  return agents;
}

function getAgentName(r: OpenAI.Responses.Response): string {
  // Try to extract agent name from metadata if present
  const meta = (r as unknown as { metadata?: Record<string, string> }).metadata;
  return meta?.["agent_name"] ?? meta?.["assistant_name"] ?? r.model ?? "Agent";
}

function groupIntoSessions(
  responses: OpenAI.Responses.Response[]
): TraceSession[] {
  // Build a chain: response.previous_response_id → response
  const byId = new Map(responses.map((r) => [r.id, r]));

  // Find roots (no previous_response_id in our set)
  const roots = responses.filter(
    (r) => !r.previous_response_id || !byId.has(r.previous_response_id)
  );

  // Build chains from each root
  const sessions: TraceSession[] = [];
  const visited = new Set<string>();

  const buildChain = (root: OpenAI.Responses.Response): OpenAI.Responses.Response[] => {
    const chain: OpenAI.Responses.Response[] = [];
    let cur: OpenAI.Responses.Response | undefined = root;
    while (cur && !visited.has(cur.id)) {
      visited.add(cur.id);
      chain.push(cur);
      // Find the next response that continues from this one
      cur = responses.find((r) => r.previous_response_id === cur!.id);
    }
    return chain;
  };

  for (const root of roots) {
    if (visited.has(root.id)) { continue; }
    const chain = buildChain(root);
    sessions.push(normalizeResponseChain(chain));
  }

  return sessions;
}

function normalizeResponseChain(
  chain: OpenAI.Responses.Response[]
): TraceSession {
  const steps: TraceStep[] = [];
  let totalInput = 0;
  let totalOutput = 0;

  for (const response of chain) {
    // User message that prompted this response
    // `input` is not on the retrieved Response type but Azure AI Agents includes it
    const userText = extractInputText((response as unknown as { input?: unknown }).input);
    if (userText) {
      steps.push({
        kind: "message",
        id: `user-${response.id}`,
        role: "user",
        content: userText,
        createdAt: isoFromUnix(response.created_at),
      } satisfies MessageStep);
    }

    // Parse output items
    const toolCallMap = new Map<string, ToolCallStep>();
    const llmStep: LlmStep = {
      kind: "llm",
      id: response.id,
      model: response.model,
      status: responseStatus(response.status),
      startedAt: isoFromUnix(response.created_at),
      toolCalls: [],
    };

    if (response.usage) {
      llmStep.tokenUsage = {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        total: response.usage.input_tokens + response.usage.output_tokens,
      } satisfies TokenUsage;
      totalInput += response.usage.input_tokens;
      totalOutput += response.usage.output_tokens;
    }

    const assistantTexts: string[] = [];

    for (const item of response.output ?? []) {
      if (item.type === "message") {
        const msg = item as OpenAI.Responses.ResponseOutputMessage;
        assistantTexts.push(extractText(msg.content));
      } else if (item.type === "function_call") {
        const call = item as OpenAI.Responses.ResponseFunctionToolCall;
        let parsedInput: unknown = call.arguments;
        try { parsedInput = JSON.parse(call.arguments); } catch { /* keep string */ }
        const toolStep: ToolCallStep = {
          kind: "toolCall",
          id: call.id ?? call.call_id,
          name: call.name,
          input: parsedInput,
          output: undefined,
          status: call.status === "completed" ? "completed"
               : call.status === "in_progress" ? "in_progress"
               : "unknown",
        };
        toolCallMap.set(call.call_id, toolStep);
        llmStep.toolCalls.push(toolStep);
      } else if (item.type === "function_call_output") {
        const out = item as OpenAI.Responses.ResponseFunctionToolCallOutputItem;
        const existing = toolCallMap.get(out.call_id);
        if (existing) {
          if (typeof out.output === "string") {
            try { existing.output = JSON.parse(out.output); }
            catch { existing.output = out.output; }
          } else {
            existing.output = out.output;
          }
        }
      }
    }

    steps.push(llmStep);

    // Assistant reply as a separate message step (after the LLM step)
    if (assistantTexts.length > 0) {
      steps.push({
        kind: "message",
        id: `assistant-${response.id}`,
        role: "assistant",
        content: assistantTexts.join("\n"),
        createdAt: isoFromUnix(response.created_at),
      } satisfies MessageStep);
    }
  }

  const first = chain[0];
  const last = chain[chain.length - 1];

  return {
    id: first.id,
    agentName: getAgentName(first),
    status: responseStatus(last.status),
    createdAt: isoFromUnix(first.created_at),
    totalTokens: totalInput + totalOutput > 0
      ? { input: totalInput, output: totalOutput, total: totalInput + totalOutput }
      : undefined,
    steps,
  };
}

// ── Legacy path (kept for type-checking, unused in current flow) ──────────────

export async function normalizeFromThreads(
  openai: OpenAI,
  assistants: OpenAI.Beta.Assistants.Assistant[],
  threads: Array<{ id: string; created_at: number; metadata: Record<string, string> }>,
  maxRuns: number,
  out: OutputChannel
): Promise<TraceAgent[]> {
  out.appendLine("normalizeFromThreads called (legacy path)");
  return [];
}
