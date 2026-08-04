import type {
  TraceAgent,
  TraceStep,
  LlmStep,
  ToolCallStep,
  MessageStep,
  TokenUsage,
} from "foundry-trace-inspector-core";

function indent(text: string, pad: string): string {
  return text
    .split("\n")
    .map((line) => pad + line)
    .join("\n");
}

function formatTokens(t: TokenUsage | undefined): string {
  if (!t) { return ""; }
  return ` (tokens: ${t.input} in / ${t.output} out / ${t.total} total)`;
}

function renderMessage(step: MessageStep): string {
  const label = step.role.toUpperCase();
  const body = step.content.trim() || "(empty)";
  return `${label}:\n${indent(body, "    ")}`;
}

function renderToolCall(step: ToolCallStep): string {
  const lines: string[] = [`tool: ${step.name} [${step.status}]`];
  if (step.input !== undefined) {
    lines.push(indent(`input:  ${stringifyValue(step.input)}`, "    "));
  }
  if (step.output !== undefined) {
    lines.push(indent(`output: ${stringifyValue(step.output)}`, "    "));
  }
  return lines.join("\n");
}

function renderLlm(step: LlmStep): string {
  const parts: string[] = [];
  const header = `llm: ${step.model ?? "unknown-model"} [${step.status}]${formatTokens(step.tokenUsage)}`;
  parts.push(header);
  for (const tc of step.toolCalls) {
    parts.push(indent(renderToolCall(tc), "  "));
  }
  return parts.join("\n");
}

function renderStep(step: TraceStep): string {
  switch (step.kind) {
    case "message": return renderMessage(step);
    case "toolCall": return renderToolCall(step);
    case "llm": return renderLlm(step);
  }
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") { return value; }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Render normalized trace agents as a human-readable tree. */
export function renderTrace(agents: TraceAgent[]): string {
  const out: string[] = [];

  for (const agent of agents) {
    out.push(`Agent: ${agent.name}${agent.model ? ` (${agent.model})` : ""}`);

    for (const session of agent.sessions) {
      out.push("");
      out.push(`  Session ${session.id} [${session.status}]${formatTokens(session.totalTokens)}`);
      if (session.createdAt) {
        out.push(`  created: ${session.createdAt}`);
      }
      out.push("");
      for (const step of session.steps) {
        out.push(indent(renderStep(step), "    "));
        out.push("");
      }
    }
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}
