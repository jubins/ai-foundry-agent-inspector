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
    // Extract trace ID from metadata if present (Azure AI Agents sets this)
    const meta = (response as unknown as { metadata?: Record<string, string> }).metadata;
    const traceId = meta?.["trace_id"] ?? meta?.["traceId"] ?? undefined;
    const responseId = response.id;

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
        responseId,
        traceId,
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
      responseId,
      traceId,
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
      } else if (item.type === "web_search_call") {
        // Built-in web search tool (ResponseFunctionWebSearch)
        const ws = item as OpenAI.Responses.ResponseFunctionWebSearch;
        const toolStep: ToolCallStep = {
          kind: "toolCall",
          id: ws.id,
          name: "web_search",
          input: (ws as unknown as { action?: unknown }).action,
          output: undefined,
          status: ws.status === "completed" ? "completed"
               : ws.status === "in_progress" ? "in_progress"
               : "unknown",
        };
        llmStep.toolCalls.push(toolStep);
      } else if (item.type === "file_search_call") {
        // Built-in file search tool (ResponseFileSearchToolCall)
        const fs = item as OpenAI.Responses.ResponseFileSearchToolCall;
        const toolStep: ToolCallStep = {
          kind: "toolCall",
          id: fs.id,
          name: "file_search",
          input: { queries: (fs as unknown as { queries?: unknown }).queries },
          output: (fs as unknown as { results?: unknown }).results,
          status: fs.status === "completed" ? "completed"
               : fs.status === "in_progress" ? "in_progress"
               : "unknown",
        };
        llmStep.toolCalls.push(toolStep);
      } else if (item.type === "code_interpreter_call") {
        // Built-in code interpreter (ResponseCodeInterpreterToolCall)
        const ci = item as OpenAI.Responses.ResponseCodeInterpreterToolCall;
        const ciAny = ci as unknown as { code?: string; outputs?: unknown; status?: string };
        const toolStep: ToolCallStep = {
          kind: "toolCall",
          id: ci.id,
          name: "code_interpreter",
          input: { code: ciAny.code },
          output: ciAny.outputs,
          status: ciAny.status === "completed" ? "completed"
               : ciAny.status === "in_progress" ? "in_progress"
               : "unknown",
        };
        llmStep.toolCalls.push(toolStep);
      } else {
        // Generic fallback for any other built-in tool type
        // (computer_call, mcp_call, image_generation_call, etc.)
        const generic = item as unknown as {
          type: string;
          id?: string;
          name?: string;
          call_id?: string;
          status?: string;
          [key: string]: unknown;
        };
        const toolName = generic.name ?? generic.type;
        if (toolName !== "message" && toolName !== "function_call_output") {
          const { type: _t, id: _id, name: _n, status: _s, ...rest } = generic;
          const toolStep: ToolCallStep = {
            kind: "toolCall",
            id: generic.id ?? generic.call_id ?? `${generic.type}-${Date.now()}`,
            name: toolName,
            input: Object.keys(rest).length > 0 ? rest : undefined,
            output: undefined,
            status: generic.status === "completed" ? "completed"
                 : generic.status === "in_progress" ? "in_progress"
                 : "unknown",
          };
          llmStep.toolCalls.push(toolStep);
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
        responseId,
        traceId,
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
    source: "response" as const,
  };
}

// ── Conversation items path ───────────────────────────────────────────────────

export interface ResponseMeta {
  id: string;
  model?: string;
  status?: string;
  createdAt?: number;
  tokenUsage?: TokenUsage;
}

type RawItem = {
  type: string;
  id?: string;
  call_id?: string;
  role?: string;
  status?: string;
  created_at?: number;
  created_by?: { response_id?: string; agent?: { name?: string; version?: string } };
  content?: Array<{ type: string; text?: string }> | string;
  name?: string;
  arguments?: string;
  action?: unknown;
  queries?: unknown;
  results?: unknown;
  code?: string;
  outputs?: unknown;
  output?: unknown;
  [key: string]: unknown;
};

export function normalizeFromConversationItems(
  conversationId: string,
  items: OpenAI.Conversations.ConversationItem[],
  responseMetas: Map<string, ResponseMeta> = new Map()
): TraceAgent[] {
  // API is called with order:"asc" so items are already chronological
  const raw = items as unknown as RawItem[];

  // ── Pass 1: Build tool-call map (id → ToolCallStep) ─────────────────────────
  const toolCallMap = new Map<string, ToolCallStep>();

  for (const item of raw) {
    const t = item.type;
    if (t === "function_call" || t === "web_search_call" ||
        t === "file_search_call" || t === "code_interpreter_call") {
      let name = item.name ?? t;
      let input: unknown;
      if (t === "function_call") {
        try { input = JSON.parse(item.arguments ?? "{}"); } catch { input = item.arguments; }
      } else if (t === "web_search_call") { name = "web_search"; input = item.action; }
      else if (t === "file_search_call")  { name = "file_search"; input = { queries: item.queries }; }
      else if (t === "code_interpreter_call") { name = "code_interpreter"; input = { code: item.code }; }

      const toolStep: ToolCallStep = {
        kind: "toolCall",
        id: item.id ?? item.call_id ?? `tool-${toolCallMap.size}`,
        name,
        input,
        output: t === "file_search_call" ? item.results : t === "code_interpreter_call" ? item.outputs : undefined,
        status: item.status === "completed" ? "completed" : item.status === "in_progress" ? "in_progress" : "unknown",
      };
      const key = item.id ?? item.call_id ?? "";
      if (key) { toolCallMap.set(key, toolStep); }
    }

    // Hydrate outputs into existing tool steps
    if (t === "function_call_output") {
      const key = item.call_id ?? "";
      const existing = key ? toolCallMap.get(key) : undefined;
      if (existing && item.output !== undefined) {
        if (typeof item.output === "string") {
          try { existing.output = JSON.parse(item.output); } catch { existing.output = item.output; }
        } else { existing.output = item.output; }
      }
    }
  }

  // ── Pass 2: Group items into turns (user → tools → assistant) ───────────────
  // API order is chronological: user_msg, tool_call(s), assistant_msg, user_msg, ...
  // We group consecutive non-user items after each user message into one turn.

  type Turn = {
    userText: string;
    userTs?: string;
    tools: ToolCallStep[];
    assistantText: string;
    assistantTs?: string;
    responseId?: string;
    agentName?: string;
    agentVersion?: string;
  };

  const turns: Turn[] = [];
  let current: Turn | null = null;

  for (const item of raw) {
    const t = item.type;

    if (t === "message" && item.role === "user") {
      // Flush previous turn if it has any content
      if (current && (current.userText || current.assistantText)) {
        turns.push(current);
      }
      const text = extractRawText(item.content, ["input_text", "text"]);
      current = {
        userText: text,
        userTs: item.created_at ? isoFromUnix(item.created_at) : undefined,
        tools: [],
        assistantText: "",
        assistantTs: undefined,
      };
    } else if (t === "message" && (item.role === "assistant" || item.role === "unknown")) {
      if (!current) { current = { userText: "", tools: [], assistantText: "", assistantTs: undefined }; }
      const text = extractRawText(item.content, ["output_text", "text"]);
      if (text) {
        current.assistantText = current.assistantText ? current.assistantText + "\n" + text : text;
        current.assistantTs ??= item.created_at ? isoFromUnix(item.created_at) : undefined;
        current.responseId ??= item.created_by?.response_id;
        current.agentName ??= item.created_by?.agent?.name;
        current.agentVersion ??= item.created_by?.agent?.version;
      }
    } else if (t === "function_call" || t === "web_search_call" ||
               t === "file_search_call" || t === "code_interpreter_call") {
      if (!current) { current = { userText: "", tools: [], assistantText: "", assistantTs: undefined }; }
      const key = item.id ?? item.call_id ?? "";
      const tc = key ? toolCallMap.get(key) : undefined;
      if (tc && !current.tools.includes(tc)) { current.tools.push(tc); }
    }
    // function_call_output is already hydrated into toolCallMap in pass 1 — skip here
  }

  if (current && (current.userText || current.assistantText || current.tools.length)) {
    turns.push(current);
  }

  // ── Pass 3: Convert turns to TraceSteps in chronological order ───────────────
  const steps: TraceStep[] = [];

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];

    if (turn.userText) {
      steps.push({
        kind: "message",
        id: `user-${i}`,
        role: "user",
        content: turn.userText,
        createdAt: turn.userTs,
      } satisfies MessageStep);
    }

    const meta = turn.responseId ? responseMetas.get(turn.responseId) : undefined;
    const llmStep: LlmStep = {
      kind: "llm",
      id: `llm-${i}`,
      model: meta?.model,
      status: meta?.status ? responseStatus(meta.status) : "completed",
      startedAt: meta?.createdAt ? isoFromUnix(meta.createdAt) : turn.assistantTs,
      toolCalls: turn.tools,
      responseId: turn.responseId,
      tokenUsage: meta?.tokenUsage,
      // Store agent name/version for span-style rendering
      ...(turn.agentName ? { agentName: turn.agentName } : {}),
      ...(turn.agentVersion ? { agentVersion: turn.agentVersion } : {}),
    };
    steps.push(llmStep);

    if (turn.assistantText) {
      steps.push({
        kind: "message",
        id: `assistant-${i}`,
        role: "assistant",
        content: turn.assistantText,
        createdAt: turn.assistantTs,
        responseId: turn.responseId,
      } satisfies MessageStep);
    }
  }

  const session: TraceSession = {
    id: conversationId,
    agentName: "Conversation",
    status: "completed",
    steps,
    source: "conversation",
  };

  return [{ id: conversationId, name: conversationId.slice(0, 20) + "…", sessions: [session] }];
}

function extractRawText(
  content: Array<{ type: string; text?: string }> | string | undefined,
  types: string[]
): string {
  if (!content) { return ""; }
  if (typeof content === "string") { return content; }
  if (!Array.isArray(content)) { return ""; }
  return content
    .filter(p => types.includes(p.type))
    .map(p => p.text ?? "")
    .join("");
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
