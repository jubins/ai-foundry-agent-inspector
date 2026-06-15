import * as vscode from "vscode";
import type { TraceAgent } from "../trace/model";

let currentPanel: vscode.WebviewPanel | undefined;

export function showTracePanel(
  context: vscode.ExtensionContext,
  agents: TraceAgent[],
  onRefresh: () => Promise<void>
): void {
  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.One);
    currentPanel.webview.postMessage({ type: "update", agents });
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    "foundryTraceTimeline",
    "Foundry Agent Trace",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  currentPanel.webview.html = buildHtml(agents);

  currentPanel.webview.onDidReceiveMessage(async (msg) => {
    if (msg.type === "refresh") {
      currentPanel?.webview.postMessage({ type: "loading" });
      await onRefresh();
    } else if (msg.type === "viewTrace") {
      // Save response ID to settings, refresh sidebar, then open its trace
      const respId: string = msg.responseId;
      if (!respId) { return; }
      const cfg = vscode.workspace.getConfiguration("aiFoundryAgentInspector");
      const existing = cfg.get<string[]>("responseIds", []);
      if (!existing.includes(respId)) {
        await cfg.update("responseIds", [...existing, respId], vscode.ConfigurationTarget.Global);
      }
      // Refresh sidebar so the new response ID appears in the Responses section
      await vscode.commands.executeCommand("foundryInspector.refresh");
      // Open the response trace panel — pass full ResponseSummary shape
      await vscode.commands.executeCommand("foundryInspector.openResponse", { id: respId });
    }
  }, null, context.subscriptions);

  currentPanel.onDidDispose(() => {
    currentPanel = undefined;
  }, null, context.subscriptions);
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtml(agents: TraceAgent[]): string {
  const data = JSON.stringify(agents);
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Foundry Agent Trace</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: var(--vscode-font-size, 13px);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 16px;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
  }
  h1 { font-size: 1.2em; font-weight: 600; }

  .refresh-btn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 3px;
    padding: 4px 12px;
    font-size: 0.85em;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .refresh-btn:hover { background: var(--vscode-button-hoverBackground); }
  .refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .spinner { display: none; }
  .spinner.active { display: inline; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .last-updated { font-size: 0.78em; color: var(--vscode-descriptionForeground); margin-left: auto; }
  h2 { font-size: 1em; font-weight: 600; margin: 20px 0 8px; }
  h3 { font-size: 0.9em; font-weight: 600; margin: 12px 0 6px; color: var(--vscode-descriptionForeground); }

  .empty {
    padding: 32px 0;
    color: var(--vscode-descriptionForeground);
    text-align: center;
  }

  /* Agent card */
  .agent-card {
    border: 1px solid var(--vscode-panel-border, #444);
    border-radius: 6px;
    margin-bottom: 20px;
    overflow: hidden;
  }
  .agent-header {
    background: var(--vscode-sideBar-background, #1e1e1e);
    padding: 10px 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    user-select: none;
  }
  .agent-header:hover { background: var(--vscode-list-hoverBackground); }
  .agent-name { font-weight: 600; }
  .agent-meta { color: var(--vscode-descriptionForeground); font-size: 0.85em; }
  .chevron { font-size: 0.7em; transition: transform 0.15s; }
  .chevron.open { transform: rotate(90deg); }
  .agent-body { padding: 12px 14px; }

  /* Session */
  .session {
    border-left: 3px solid var(--vscode-panel-border, #555);
    margin-bottom: 16px;
    padding-left: 12px;
  }
  .session.status-completed { border-color: #4ec9b0; }
  .session.status-failed    { border-color: #f48771; }
  .session.status-in_progress { border-color: #dcdcaa; }
  .session.status-unknown   { border-color: #666; }

  .session-header {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }
  .session-id { font-family: var(--vscode-editor-font-family, monospace); font-size: 0.8em; color: var(--vscode-descriptionForeground); }
  .badge {
    font-size: 0.75em;
    padding: 1px 6px;
    border-radius: 10px;
    font-weight: 600;
  }
  .badge-completed  { background: #4ec9b030; color: #4ec9b0; }
  .badge-failed     { background: #f4877130; color: #f48771; }
  .badge-in_progress{ background: #dcdcaa30; color: #dcdcaa; }
  .badge-unknown    { background: #66666630; color: #aaa; }

  .token-summary {
    font-size: 0.8em;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 10px;
  }
  .token-summary span { margin-right: 10px; }

  /* Chat layout — oldest at top, newest at bottom */
  .steps { display: flex; flex-direction: column; gap: 0; }
  .chat-turn { display: flex; flex-direction: column; gap: 5px; margin-bottom: 20px; }

  /* Timestamp divider */
  .turn-ts {
    text-align: center;
    font-size: 0.72em;
    color: var(--vscode-descriptionForeground);
    margin: 6px 0 12px;
    opacity: 0.6;
  }

  /* Bubble wrappers for positioning popovers */
  .bubble-wrapper { position: relative; display: flex; flex-direction: column; }
  .bubble-wrapper-user  { align-self: flex-end; align-items: flex-end; }
  .bubble-wrapper-assistant { align-self: flex-start; align-items: flex-start; }

  /* User bubble — right aligned, clickable */
  .bubble-user {
    align-self: flex-end;
    max-width: 72%;
    background: var(--vscode-button-background, #0078d4);
    color: var(--vscode-button-foreground, #fff);
    border-radius: 16px 16px 4px 16px;
    padding: 9px 14px;
    font-size: 0.88em;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
    cursor: pointer;
    user-select: text;
  }
  .bubble-user:hover { opacity: 0.92; }

  /* Assistant bubble — left aligned, clickable */
  .bubble-assistant {
    align-self: flex-start;
    max-width: 82%;
    background: var(--vscode-editor-inactiveSelectionBackground, #2a2d2e);
    border: 1px solid var(--vscode-panel-border, #3c3c3c);
    border-radius: 16px 16px 16px 4px;
    padding: 9px 14px;
    font-size: 0.88em;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
    cursor: pointer;
    user-select: text;
  }
  .bubble-assistant:hover { border-color: var(--vscode-focusBorder, #0078d4); }

  /* Popover card that appears below a bubble on click */
  .bubble-popover {
    display: none;
    flex-direction: column;
    gap: 5px;
    margin-top: 4px;
    padding: 10px 12px;
    background: var(--vscode-editorWidget-background, #252526);
    border: 1px solid var(--vscode-panel-border, #454545);
    border-radius: 6px;
    font-size: 0.8em;
    min-width: 240px;
    max-width: 420px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10;
  }
  .bubble-popover.open { display: flex; }
  .meta-row { display: flex; gap: 8px; align-items: flex-start; }
  .meta-key {
    color: var(--vscode-descriptionForeground);
    min-width: 90px;
    flex-shrink: 0;
    padding-top: 1px;
    font-size: 0.9em;
  }
  .meta-val {
    color: var(--vscode-foreground);
    word-break: break-all;
    line-height: 1.4;
  }
  .meta-val.mono {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 0.88em;
  }

  /* "View Trace" button inside the popover */
  .view-trace-btn {
    display: inline-flex; align-items: center; gap: 5px;
    background: var(--vscode-button-background, #0078d4);
    color: var(--vscode-button-foreground, #fff);
    border: none; border-radius: 3px;
    padding: 5px 12px;
    font-size: 0.88em;
    cursor: pointer;
    font-family: inherit;
  }
  .view-trace-btn:hover { background: var(--vscode-button-hoverBackground); }

  /* Tool call pills between user and assistant bubbles */
  .tool-calls-block {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-self: flex-start;
    padding-left: 2px;
    margin: 4px 0;
  }
  .tool-calls-label {
    font-size: 0.72em;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--vscode-descriptionForeground);
    opacity: 0.7;
    margin-bottom: 2px;
  }
  .tool-pills { display: flex; flex-wrap: wrap; gap: 5px; padding: 0; }
  .tool-pill {
    display: inline-flex; align-items: center; gap: 5px;
    background: #dcdcaa18;
    border: 1px solid #dcdcaa40;
    border-radius: 12px;
    padding: 3px 10px;
    font-size: 0.78em;
    cursor: pointer;
    color: #dcdcaa;
    user-select: none;
  }
  .tool-pill:hover { background: #dcdcaa28; }
  .tool-pill-icon { font-size: 0.9em; }

  /* Expandable tool detail */
  .tool-detail {
    display: none;
    background: var(--vscode-textCodeBlock-background, #1a1a1a);
    border: 1px solid #dcdcaa30;
    border-radius: 6px;
    padding: 10px;
    margin: 2px 0 4px;
    font-size: 0.82em;
  }
  .tool-detail.open { display: block; }

  /* LLM internal step (collapsed by default, shown as subtle bar) */
  .step-llm {
    border: 1px solid #569cd630;
    border-radius: 4px;
    background: #569cd608;
    overflow: hidden;
    margin-bottom: 4px;
  }
  .step-header {
    display: flex; align-items: center; gap: 8px;
    padding: 5px 10px;
    cursor: pointer; user-select: none; font-size: 0.82em;
  }
  .step-header:hover { background: var(--vscode-list-hoverBackground); }
  .step-icon { font-size: 0.9em; width: 16px; text-align: center; flex-shrink: 0; }
  .step-label { font-weight: 500; flex: 1; }
  .step-tokens { font-size: 0.75em; color: var(--vscode-descriptionForeground); margin-left: auto; white-space: nowrap; }
  .step-body { padding: 6px 10px 8px 34px; display: none; border-top: 1px solid #569cd620; }
  .step-body.open { display: block; }
  .step-status-failed { color: #f48771; }

  .tool-section { margin-top: 8px; }
  .tool-section h4 { font-size: 0.78em; text-transform: uppercase; letter-spacing: 0.05em; color: var(--vscode-descriptionForeground); margin-bottom: 4px; }
  .code-block {
    background: var(--vscode-textCodeBlock-background, #1e1e1e);
    border: 1px solid var(--vscode-panel-border, #333);
    border-radius: 3px;
    padding: 8px;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 0.82em;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 200px;
    overflow-y: auto;
    line-height: 1.4;
  }

  /* Sub-steps (tool calls inside LLM step) */
  .sub-steps { display: flex; flex-direction: column; gap: 5px; margin-top: 6px; }
  .sub-step { border: 1px solid #dcdcaa30; border-radius: 3px; background: #dcdcaa08; overflow: hidden; }
  .sub-step-header { padding: 5px 8px; display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.85em; user-select: none; }
  .sub-step-header:hover { background: var(--vscode-list-hoverBackground); }
  .sub-step-body { display: none; padding: 6px 8px 8px; border-top: 1px solid #dcdcaa20; }
  .sub-step-body.open { display: block; }

  .no-sessions { color: var(--vscode-descriptionForeground); font-size: 0.88em; padding: 8px 0; }
  .no-steps    { color: var(--vscode-descriptionForeground); font-size: 0.85em; font-style: italic; }

  .ts { color: var(--vscode-descriptionForeground); font-size: 0.78em; }

  /* Token chart */
  .token-chart { margin-bottom: 14px; }
  .token-chart-title { font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.05em; color: var(--vscode-descriptionForeground); margin-bottom: 6px; }
  .token-chart svg { display: block; width: 100%; overflow: visible; }
  .chart-bar-input  { fill: #569cd6; }
  .chart-bar-output { fill: #4ec9b0; }
  .chart-label { font-size: 10px; fill: var(--vscode-descriptionForeground, #888); font-family: var(--vscode-font-family, system-ui); }
  .chart-legend { display: flex; gap: 14px; margin-top: 5px; font-size: 0.78em; color: var(--vscode-descriptionForeground); }
  .chart-legend-dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }

  /* Gantt chart */
  .gantt { margin-bottom: 16px; }
  .gantt-title { font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.05em; color: var(--vscode-descriptionForeground); margin-bottom: 6px; }
  .gantt-row { display: flex; align-items: center; gap: 0; height: 22px; margin-bottom: 3px; font-size: 0.8em; }
  .gantt-label { width: 130px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--vscode-foreground); padding-right: 8px; text-align: right; font-size: 0.85em; }
  .gantt-track { flex: 1; position: relative; height: 16px; background: var(--vscode-textCodeBlock-background, #1a1a1a); border-radius: 2px; overflow: visible; }
  .gantt-bar {
    position: absolute;
    top: 0; height: 100%;
    border-radius: 3px;
    min-width: 3px;
    cursor: pointer;
    transition: opacity 0.1s;
  }
  .gantt-bar:hover { opacity: 0.8; }
  .gantt-bar-llm     { background: #569cd6cc; }
  .gantt-bar-tool    { background: #dcdcaa99; }
  .gantt-bar-message { background: #4ec9b066; }
  .gantt-duration { margin-left: 6px; font-size: 0.78em; color: var(--vscode-descriptionForeground); white-space: nowrap; flex-shrink: 0; }
  .gantt-axis { display: flex; margin-left: 130px; font-size: 0.72em; color: var(--vscode-descriptionForeground); margin-bottom: 4px; }
  .gantt-legend { display: flex; gap: 14px; margin-top: 6px; font-size: 0.78em; color: var(--vscode-descriptionForeground); }
  .gantt-legend-dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
</style>
</head>
<body>
<div class="toolbar">
  <h1>🔍 Foundry Agent Trace</h1>
  <button class="refresh-btn" id="refreshBtn" onclick="doRefresh()">
    <span class="spinner" id="spinner">↻</span>
    <span id="refreshLabel">↻ Refresh</span>
  </button>
  <span class="last-updated" id="lastUpdated"></span>
</div>
<div id="root"></div>

<script>
(function() {
  const agents = ${data};

  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') e.className = v;
      else if (k === 'style') e.style.cssText = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
      else e.setAttribute(k, v);
    });
    children.flat().forEach(c => {
      if (c == null) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function fmtTs(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  }

  function toggleCollapse(bodyEl, chevronEl) {
    const open = bodyEl.classList.toggle('open');
    if (chevronEl) chevronEl.classList.toggle('open', open);
  }

  function makeCodeBlock(value) {
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    const d = el('div', {'class': 'code-block'});
    d.textContent = text;
    return d;
  }

  function renderToolCall(tc) {
    const body = el('div', {'class': 'sub-step-body'});
    const inSec = el('div', {'class': 'tool-section'},
      el('h4', {}, 'Input'),
      makeCodeBlock(tc.input)
    );
    body.appendChild(inSec);
    if (tc.output !== undefined) {
      body.appendChild(el('div', {'class': 'tool-section'},
        el('h4', {}, 'Output'),
        makeCodeBlock(tc.output)
      ));
    }

    const statusIcon = tc.status === 'failed' ? ' ⚠' : '';
    const header = el('div', {'class': 'sub-step-header'},
      el('span', {}, '🔧'),
      el('span', {'style': 'font-weight:500; flex:1'}, tc.name),
      el('span', {'class': 'step-status' + (tc.status === 'failed' ? ' step-status-failed' : '')}, statusIcon)
    );
    header.addEventListener('click', () => body.classList.toggle('open'));

    return el('div', {'class': 'sub-step'}, header, body);
  }

  // Tool call pill + expandable detail (shown between bubbles)
  function renderToolPill(tc) {
    const toolIcon = tc.name === 'web_search' ? '🌐'
                   : tc.name === 'file_search' ? '📂'
                   : tc.name === 'code_interpreter' ? '💻'
                   : '🔧';
    const detail = el('div', {'class': 'tool-detail'});
    detail.appendChild(el('div', {'class': 'tool-section'}, el('h4', {}, 'Input'), makeCodeBlock(tc.input)));
    if (tc.output !== undefined) {
      detail.appendChild(el('div', {'class': 'tool-section'}, el('h4', {}, 'Output'), makeCodeBlock(tc.output)));
    }
    const pill = el('div', {'class': 'tool-pill'},
      el('span', {'class': 'tool-pill-icon'}, toolIcon),
      tc.name,
      tc.status === 'failed' ? el('span', {'style': 'color:#f48771'}, ' ⚠') : null
    );
    pill.addEventListener('click', () => detail.classList.toggle('open'));
    return [pill, detail];
  }

  // Popover card anchored below a bubble — toggled on click
  function makePopover(contentFn) {
    const pop = el('div', {'class': 'bubble-popover'});
    contentFn(pop);
    return pop;
  }

  // User bubble with optional trace-ID popover
  function renderUserBubble(step) {
    const bubble = el('div', {'class': 'bubble-user'});
    bubble.appendChild(document.createTextNode(step.content || '(empty)'));

    const traceId = step.traceId;
    const ts = step.createdAt;
    if (!traceId && !ts) { return [bubble, null]; }

    const pop = makePopover(p => {
      if (ts) {
        p.appendChild(el('div', {'class': 'meta-row'},
          el('span', {'class': 'meta-key'}, 'Sent'),
          el('span', {'class': 'meta-val'}, fmtTs(ts))
        ));
      }
      if (traceId) {
        p.appendChild(el('div', {'class': 'meta-row'},
          el('span', {'class': 'meta-key'}, 'Trace ID'),
          el('span', {'class': 'meta-val mono'}, traceId)
        ));
      }
    });

    const wrapper = el('div', {'class': 'bubble-wrapper bubble-wrapper-user'});
    wrapper.appendChild(bubble);
    wrapper.appendChild(pop);
    bubble.addEventListener('click', (e) => { e.stopPropagation(); pop.classList.toggle('open'); });
    document.addEventListener('click', () => pop.classList.remove('open'), { capture: false });

    return [wrapper, null];
  }

  // Assistant bubble with optional response-ID popover + View Trace button.
  // showViewTrace=true only for conversations; in responses view bubbles are not clickable.
  function renderAssistantBubble(step, llmStep, showViewTrace) {
    const bubble = el('div', {'class': 'bubble-assistant'});
    bubble.appendChild(document.createTextNode(step.content || '(empty)'));

    // In responses view: no popover, bubble is not interactive
    if (!showViewTrace) {
      return [bubble, null];
    }

    const responseId = step.responseId ?? llmStep?.responseId ?? null;

    // Only show popover if we have a response ID to link to
    if (!responseId) { return [bubble, null]; }

    const pop = makePopover(p => {
      p.appendChild(el('div', {'class': 'meta-row'},
        el('span', {'class': 'meta-key'}, 'Response ID'),
        el('span', {'class': 'meta-val mono'}, responseId)
      ));
      const btn = el('button', {'class': 'view-trace-btn'}, '↗ View Trace');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        vscode.postMessage({ type: 'viewTrace', responseId });
        pop.classList.remove('open');
      });
      p.appendChild(el('div', {'class': 'meta-row', 'style': 'margin-top:8px'}, btn));
    });

    const wrapper = el('div', {'class': 'bubble-wrapper bubble-wrapper-assistant'});
    wrapper.appendChild(bubble);
    wrapper.appendChild(pop);
    bubble.addEventListener('click', (e) => { e.stopPropagation(); pop.classList.toggle('open'); });
    document.addEventListener('click', () => pop.classList.remove('open'), { capture: false });

    return [wrapper, null];
  }

  // Subtle timestamp line between turns
  function renderTimestamp(iso) {
    if (!iso) { return null; }
    return el('div', {'class': 'turn-ts'}, fmtTs(iso));
  }

  // Group steps into turns and render as chronological chat
  function renderStepsAsTurns(steps, showViewTrace) {
    // Build turns: group user msg → llm + tools → assistant msg
    const turns = [];
    let current = null;

    for (const step of steps) {
      if (step.kind === 'message' && step.role === 'user') {
        if (current) { turns.push(current); }
        current = { user: step, llm: null, tools: [], assistant: null };
      } else if (step.kind === 'llm') {
        if (!current) { current = { user: null, llm: null, tools: [], assistant: null }; }
        current.llm = step;
        current.tools = step.toolCalls ?? [];
      } else if (step.kind === 'message' && step.role === 'assistant') {
        if (!current) { current = { user: null, llm: null, tools: [], assistant: null }; }
        current.assistant = step;
        turns.push(current);
        current = null;
      } else if (step.kind === 'toolCall') {
        if (!current) { current = { user: null, llm: null, tools: [], assistant: null }; }
        current.tools.push(step);
      }
    }
    if (current) { turns.push(current); }

    // Render oldest first (turns are already in chronological order)
    const nodes = [];
    turns.forEach((turn, idx) => {
      // Timestamp divider before first message or when date changes
      const ts = turn.user?.createdAt ?? turn.llm?.startedAt ?? turn.assistant?.createdAt;
      if (idx === 0 && ts) {
        nodes.push(renderTimestamp(ts));
      }

      const children = [];

      // User bubble
      if (turn.user) {
        const [node] = renderUserBubble(turn.user);
        children.push(node);
      }

      // Tool call pills (below user bubble, left-aligned with assistant)
      if (turn.tools.length > 0) {
        const pillRow = el('div', {'class': 'tool-pills'});
        const details = [];
        for (const tc of turn.tools) {
          const [pill, detail] = renderToolPill(tc);
          pillRow.appendChild(pill);
          if (detail) { details.push(detail); }
        }
        const block = el('div', {'class': 'tool-calls-block'},
          el('div', {'class': 'tool-calls-label'}, 'Tool Calls'),
          pillRow,
          ...details
        );
        children.push(block);
      }

      // Assistant bubble
      if (turn.assistant) {
        const [node] = renderAssistantBubble(turn.assistant, turn.llm, showViewTrace);
        children.push(node);
      }

      nodes.push(el('div', {'class': 'chat-turn'}, ...children));
    });

    return nodes.filter(Boolean);
  }

  // LLM-only step (no chat messages — keep compact card style)
  function renderLlmStep(step) {
    const tokenText = step.tokenUsage
      ? el('span', {'class': 'step-tokens'}, \`\${step.tokenUsage.input}↑ \${step.tokenUsage.output}↓\`)
      : null;
    const body = el('div', {'class': 'step-body'});
    if (step.toolCalls.length > 0) {
      body.appendChild(el('div', {'class': 'tool-section'},
        el('h4', {}, \`Tool Calls (\${step.toolCalls.length})\`),
        el('div', {'class': 'sub-steps'}, ...step.toolCalls.map(renderToolCall))
      ));
    } else {
      body.appendChild(el('div', {'class': 'no-steps'}, 'No tool calls'));
    }
    const header = el('div', {'class': 'step-header'},
      el('span', {'class': 'step-icon'}, '🧠'),
      el('span', {'class': 'step-label'}, 'LLM Turn'),
      tokenText
    );
    header.addEventListener('click', () => toggleCollapse(body, null));
    return el('div', {'class': 'step-llm'}, header, body);
  }

  function renderTokenChart(steps) {
    // Collect LLM steps that have token usage
    const llmSteps = steps.filter(s => s.kind === 'llm' && s.tokenUsage);
    if (llmSteps.length === 0) { return null; }

    const BAR_H = 14;
    const GAP = 6;
    const LABEL_W = 28;
    const CHART_W = 340;
    const totalH = llmSteps.length * (BAR_H + GAP);

    const maxTokens = Math.max(...llmSteps.map(s => s.tokenUsage.total));

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', \`0 0 \${CHART_W + LABEL_W + 60} \${totalH}\`);
    svg.setAttribute('height', String(totalH));

    llmSteps.forEach((step, i) => {
      const y = i * (BAR_H + GAP);
      const inputW = maxTokens > 0 ? (step.tokenUsage.input / maxTokens) * CHART_W : 0;
      const outputW = maxTokens > 0 ? (step.tokenUsage.output / maxTokens) * CHART_W : 0;

      // Turn label (Turn 1, Turn 2…)
      const lbl = document.createElementNS(svgNS, 'text');
      lbl.setAttribute('x', '0');
      lbl.setAttribute('y', String(y + BAR_H - 2));
      lbl.setAttribute('class', 'chart-label');
      lbl.textContent = \`T\${i + 1}\`;
      svg.appendChild(lbl);

      // Input bar
      const inRect = document.createElementNS(svgNS, 'rect');
      inRect.setAttribute('x', String(LABEL_W));
      inRect.setAttribute('y', String(y));
      inRect.setAttribute('width', String(inputW));
      inRect.setAttribute('height', String(BAR_H));
      inRect.setAttribute('class', 'chart-bar-input');
      inRect.setAttribute('rx', '2');
      svg.appendChild(inRect);

      // Output bar (stacked after input)
      const outRect = document.createElementNS(svgNS, 'rect');
      outRect.setAttribute('x', String(LABEL_W + inputW));
      outRect.setAttribute('y', String(y));
      outRect.setAttribute('width', String(outputW));
      outRect.setAttribute('height', String(BAR_H));
      outRect.setAttribute('class', 'chart-bar-output');
      outRect.setAttribute('rx', '2');
      svg.appendChild(outRect);

      // Value label
      const val = document.createElementNS(svgNS, 'text');
      val.setAttribute('x', String(LABEL_W + inputW + outputW + 4));
      val.setAttribute('y', String(y + BAR_H - 2));
      val.setAttribute('class', 'chart-label');
      val.textContent = \`\${step.tokenUsage.input}↑ \${step.tokenUsage.output}↓\`;
      svg.appendChild(val);
    });

    const legend = el('div', {'class': 'chart-legend'},
      el('span', {},
        el('span', {'class': 'chart-legend-dot', 'style': 'background:#569cd6'}, ''),
        'Input tokens'
      ),
      el('span', {},
        el('span', {'class': 'chart-legend-dot', 'style': 'background:#4ec9b0'}, ''),
        'Output tokens'
      )
    );

    return el('div', {'class': 'token-chart'},
      el('div', {'class': 'token-chart-title'}, 'Token usage per LLM turn'),
      svg,
      legend
    );
  }

  function fmtMs(ms) {
    if (ms == null) { return ''; }
    if (ms < 1000) { return ms + 'ms'; }
    return (ms / 1000).toFixed(1) + 's';
  }

  function renderGantt(steps) {
    // Only render if any step has timing info
    const timed = steps.filter(s => s.startedAt || s.completedAt);
    if (timed.length < 2) { return null; }

    // Find global time range
    const toMs = iso => iso ? new Date(iso).getTime() : null;
    const allStarts = steps.map(s => toMs(s.startedAt)).filter(Boolean);
    const allEnds   = steps.map(s => toMs(s.completedAt)).filter(Boolean);
    if (allStarts.length === 0) { return null; }

    const globalStart = Math.min(...allStarts);
    const globalEnd   = allEnds.length > 0 ? Math.max(...allEnds) : Math.max(...allStarts) + 1000;
    const totalMs     = Math.max(globalEnd - globalStart, 1);

    const rows = [];

    steps.forEach((step, idx) => {
      const start = toMs(step.startedAt);
      const end   = toMs(step.completedAt);
      if (!start) { return; }
      const endMs   = end ?? (start + Math.max(totalMs * 0.05, 100));
      const durMs   = endMs - start;
      const leftPct = ((start - globalStart) / totalMs) * 100;
      const widthPct = Math.max((durMs / totalMs) * 100, 0.5);

      let label, barClass;
      if (step.kind === 'llm') {
        label = 'LLM Turn ' + (idx + 1);
        barClass = 'gantt-bar-llm';
      } else if (step.kind === 'toolCall') {
        label = step.name ?? 'tool';
        barClass = 'gantt-bar-tool';
      } else {
        label = step.role === 'user' ? 'User' : 'Assistant';
        barClass = 'gantt-bar-message';
      }

      const bar = el('div', {
        'class': 'gantt-bar ' + barClass,
        'style': \`left:\${leftPct.toFixed(2)}%; width:\${widthPct.toFixed(2)}%\`,
        'title': \`\${label}: \${fmtMs(durMs)}\`
      });

      const track = el('div', {'class': 'gantt-track'}, bar);
      const dur   = el('div', {'class': 'gantt-duration'}, fmtMs(durMs));
      const lbl   = el('div', {'class': 'gantt-label'}, label);

      rows.push(el('div', {'class': 'gantt-row'}, lbl, track, dur));
    });

    if (rows.length === 0) { return null; }

    // Axis: 0ms and totalMs
    const axis = el('div', {'class': 'gantt-axis'},
      el('span', {'style': 'flex:0'}, '0'),
      el('span', {'style': 'flex:1; text-align:right'}, fmtMs(totalMs))
    );

    const legend = el('div', {'class': 'gantt-legend'},
      el('span', {}, el('span', {'class': 'gantt-legend-dot', 'style': 'background:#569cd6cc'}, ''), 'LLM'),
      el('span', {}, el('span', {'class': 'gantt-legend-dot', 'style': 'background:#dcdcaa99'}, ''), 'Tool call'),
      el('span', {}, el('span', {'class': 'gantt-legend-dot', 'style': 'background:#4ec9b066'}, ''), 'Message')
    );

    return el('div', {'class': 'gantt'},
      el('div', {'class': 'gantt-title'}, 'Timeline (Gantt)'),
      axis,
      ...rows,
      legend
    );
  }

  function renderSession(session) {
    const badgeCls = 'badge badge-' + session.status;
    const sessionCls = 'session status-' + session.status;

    const tokenInfo = session.totalTokens
      ? el('div', {'class': 'token-summary'},
          el('span', {}, '📊 Tokens:'),
          el('span', {}, \`\${session.totalTokens.input} in\`),
          el('span', {}, \`\${session.totalTokens.output} out\`),
          el('span', {}, \`\${session.totalTokens.total} total\`)
        )
      : null;

    const tokenChart = renderTokenChart(session.steps);
    const gantt = renderGantt(session.steps);

    const hasChatSteps = session.steps.some(s => s.kind === 'message');
    const showViewTrace = session.source === 'conversation';
    let stepsEl;
    if (session.steps.length === 0) {
      stepsEl = el('div', {'class': 'no-steps'}, 'No steps — start a conversation with the agent to generate trace data.');
    } else if (hasChatSteps) {
      stepsEl = el('div', {'class': 'steps'}, ...renderStepsAsTurns(session.steps, showViewTrace));
    } else {
      stepsEl = el('div', {'class': 'steps'}, ...session.steps.map(s => s.kind === 'llm' ? renderLlmStep(s) : el('div', {}, '')));
    }

    return el('div', {'class': sessionCls},
      el('div', {'class': 'session-header'},
        el('span', {'class': 'session-id'}, session.id),
        el('span', {'class': badgeCls}, session.status),
        session.createdAt ? el('span', {'class': 'ts'}, fmtTs(session.createdAt)) : null
      ),
      tokenInfo,
      gantt,
      tokenChart,
      stepsEl
    );
  }

  function renderAgent(agent) {
    const body = el('div', {'class': 'agent-body'});
    const chevron = el('span', {'class': 'chevron open'}, '▶');

    if (agent.sessions.length === 0) {
      body.appendChild(el('div', {'class': 'no-sessions'},
        'No sessions found. Open the agent in the Foundry portal and send a message to generate trace data.'
      ));
    } else {
      agent.sessions.forEach(s => body.appendChild(renderSession(s)));
    }

    const meta = [agent.model, agent.version ? \`v\${agent.version}\` : null].filter(Boolean).join(' · ');
    const header = el('div', {'class': 'agent-header'},
      chevron,
      el('span', {'class': 'agent-name'}, agent.name),
      meta ? el('span', {'class': 'agent-meta'}, meta) : null
    );
    header.addEventListener('click', () => toggleCollapse(body, chevron));
    body.classList.add('open');

    return el('div', {'class': 'agent-card'}, header, body);
  }

  function render(agentList) {
    const root = document.getElementById('root');
    root.innerHTML = '';
    if (!agentList || agentList.length === 0) {
      root.appendChild(el('div', {'class': 'empty'}, 'No agents found. Configure your Foundry project endpoint and run "Foundry Trace: Show Trace".'));
      return;
    }
    agentList.forEach(a => root.appendChild(renderAgent(a)));
  }

  const vscode = acquireVsCodeApi();

  function doRefresh() {
    const btn = document.getElementById('refreshBtn');
    const spinner = document.getElementById('spinner');
    const label = document.getElementById('refreshLabel');
    if (btn) btn.disabled = true;
    if (spinner) spinner.classList.add('active');
    if (label) label.textContent = ' Refreshing…';
    vscode.postMessage({ type: 'refresh' });
  }
  window.doRefresh = doRefresh;

  function setLoading(on) {
    const btn = document.getElementById('refreshBtn');
    const spinner = document.getElementById('spinner');
    const label = document.getElementById('refreshLabel');
    if (btn) btn.disabled = on;
    if (spinner) spinner.classList.toggle('active', on);
    if (label) label.textContent = on ? ' Refreshing…' : '↻ Refresh';
  }

  render(agents);
  document.getElementById('lastUpdated').textContent = 'Updated ' + new Date().toLocaleTimeString();

  // Messages from extension
  window.addEventListener('message', e => {
    if (e.data?.type === 'update') {
      render(e.data.agents);
      setLoading(false);
      document.getElementById('lastUpdated').textContent = 'Updated ' + new Date().toLocaleTimeString();
    } else if (e.data?.type === 'loading') {
      setLoading(true);
    }
  });
})();
</script>
</body>
</html>`;
}
