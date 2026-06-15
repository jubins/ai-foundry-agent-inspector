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

  /* Steps */
  .steps { display: flex; flex-direction: column; gap: 6px; }

  .step {
    border-radius: 4px;
    border: 1px solid transparent;
    overflow: hidden;
  }
  .step-message-user      { border-color: var(--vscode-panel-border, #444); background: var(--vscode-textBlockQuote-background, #1a2030); }
  .step-message-assistant { border-color: var(--vscode-panel-border, #444); background: var(--vscode-editor-inactiveSelectionBackground, #202020); }
  .step-llm               { border-color: #569cd640; background: #569cd610; }
  .step-toolCall          { border-color: #dcdcaa40; background: #dcdcaa10; }

  .step-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    cursor: pointer;
    user-select: none;
  }
  .step-header:hover { background: var(--vscode-list-hoverBackground); }

  .step-icon { font-size: 0.9em; width: 16px; text-align: center; flex-shrink: 0; }
  .step-label { font-weight: 500; font-size: 0.85em; flex: 1; }
  .step-role  { font-size: 0.75em; color: var(--vscode-descriptionForeground); text-transform: uppercase; letter-spacing: 0.05em; }
  .step-tokens { font-size: 0.75em; color: var(--vscode-descriptionForeground); margin-left: auto; white-space: nowrap; }
  .step-status { font-size: 0.7em; }
  .step-status-failed { color: #f48771; }

  .step-body {
    padding: 8px 10px 10px 34px;
    display: none;
    border-top: 1px solid var(--vscode-panel-border, #333);
  }
  .step-body.open { display: block; }

  .message-content {
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 0.88em;
    line-height: 1.5;
  }

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
  .sub-step {
    border: 1px solid #dcdcaa30;
    border-radius: 3px;
    background: #dcdcaa08;
    overflow: hidden;
  }
  .sub-step-header {
    padding: 5px 8px;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 0.85em;
    user-select: none;
  }
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

  function renderStep(step) {
    if (step.kind === 'message') {
      const isUser = step.role === 'user';
      const body = el('div', {'class': 'step-body'},
        el('div', {'class': 'message-content'}, step.content || '(empty)')
      );
      if (step.createdAt) body.appendChild(el('div', {'class': 'ts', 'style': 'margin-top:6px'}, fmtTs(step.createdAt)));

      const icon = isUser ? '👤' : '🤖';
      const label = isUser ? 'User' : 'Assistant';
      const cls = isUser ? 'step-message-user' : 'step-message-assistant';
      const header = el('div', {'class': 'step-header'},
        el('span', {'class': 'step-icon'}, icon),
        el('span', {'class': 'step-label'}, label),
        el('span', {'class': 'step-role'}, step.role)
      );
      header.addEventListener('click', () => toggleCollapse(body, null));

      // Messages open by default
      body.classList.add('open');
      return el('div', {'class': 'step ' + cls}, header, body);
    }

    if (step.kind === 'llm') {
      const tokenText = step.tokenUsage
        ? el('span', {'class': 'step-tokens'}, \`\${step.tokenUsage.input}↑ \${step.tokenUsage.output}↓\`)
        : null;

      const body = el('div', {'class': 'step-body'});
      if (step.toolCalls.length > 0) {
        const subSteps = el('div', {'class': 'sub-steps'}, ...step.toolCalls.map(renderToolCall));
        body.appendChild(el('div', {'class': 'tool-section'},
          el('h4', {}, \`Tool Calls (\${step.toolCalls.length})\`),
          subSteps
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

      return el('div', {'class': 'step step-llm'}, header, body);
    }

    if (step.kind === 'toolCall') {
      // Top-level standalone tool call (not nested under LLM)
      const body = el('div', {'class': 'step-body'},
        el('div', {'class': 'tool-section'}, el('h4', {}, 'Input'), makeCodeBlock(step.input))
      );
      if (step.output !== undefined) {
        body.appendChild(el('div', {'class': 'tool-section'}, el('h4', {}, 'Output'), makeCodeBlock(step.output)));
      }

      const header = el('div', {'class': 'step-header'},
        el('span', {'class': 'step-icon'}, '🔧'),
        el('span', {'class': 'step-label'}, step.name),
        el('span', {'class': 'step-role'}, 'tool call')
      );
      header.addEventListener('click', () => toggleCollapse(body, null));

      return el('div', {'class': 'step step-toolCall'}, header, body);
    }

    return el('div', {}, '(unknown step)');
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

    const chart = renderTokenChart(session.steps);

    const stepsEl = session.steps.length > 0
      ? el('div', {'class': 'steps'}, ...session.steps.map(renderStep))
      : el('div', {'class': 'no-steps'}, 'No steps — start a conversation with the agent to generate trace data.');

    return el('div', {'class': sessionCls},
      el('div', {'class': 'session-header'},
        el('span', {'class': 'session-id'}, session.id),
        el('span', {'class': badgeCls}, session.status),
        session.createdAt ? el('span', {'class': 'ts'}, fmtTs(session.createdAt)) : null
      ),
      tokenInfo,
      chart,
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
