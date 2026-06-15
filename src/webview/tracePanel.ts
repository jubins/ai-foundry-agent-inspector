import * as vscode from "vscode";
import type { TraceAgent } from "../trace/model";
import { getConnectionState, setConnectionState } from "../sidebar/connectionState";

let currentPanel: vscode.WebviewPanel | undefined;
let _onRevealSidebar: ((responseId: string) => void) | undefined;

export function showTracePanel(
  context: vscode.ExtensionContext,
  agents: TraceAgent[],
  onRefresh: () => Promise<void>,
  highlightResponseId?: string,
  onRevealSidebar?: (responseId: string) => void
): void {
  if (onRevealSidebar) { _onRevealSidebar = onRevealSidebar; }

  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.One);
    currentPanel.webview.postMessage({ type: "update", agents, highlightResponseId });
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
      const respId: string = msg.responseId;
      if (!respId) { return; }
      // Save to settings so it persists across sessions
      const cfg = vscode.workspace.getConfiguration("aiFoundryAgentInspector");
      const existing = cfg.get<string[]>("responseIds", []);
      if (!existing.includes(respId)) {
        await cfg.update("responseIds", [...existing, respId], vscode.ConfigurationTarget.Global);
      }
      // Immediately add a placeholder to the sidebar so the entry appears without waiting for a full API refresh
      const state = getConnectionState();
      if (!state.responses.find(r => r.id === respId)) {
        setConnectionState({ responses: [...state.responses, { id: respId }] });
      }
      // Open the individual response trace, then reveal in sidebar
      await vscode.commands.executeCommand("foundryInspector.openResponse", { id: respId });
      setTimeout(() => {
        if (_onRevealSidebar) { _onRevealSidebar(respId); }
      }, 400);
      // Hydrate full metadata in the background
      vscode.commands.executeCommand("foundryInspector.silentRefresh");
    }
  }, null, context.subscriptions);

  currentPanel.onDidDispose(() => {
    currentPanel = undefined;
  }, null, context.subscriptions);
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
    padding: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* ── Top toolbar ── */
  .toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px 0;
    flex-shrink: 0;
  }
  h1 { font-size: 1.1em; font-weight: 600; }

  .refresh-btn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 3px;
    padding: 4px 12px;
    font-size: 0.85em;
    cursor: pointer;
  }
  .refresh-btn:hover { background: var(--vscode-button-hoverBackground); }
  .refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .spinner { display: none; }
  .spinner.active { display: inline; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .last-updated { font-size: 0.78em; color: var(--vscode-descriptionForeground); margin-left: auto; }

  /* ── Tab bar ── */
  .tab-bar {
    display: flex;
    gap: 0;
    padding: 10px 16px 0;
    border-bottom: 1px solid var(--vscode-panel-border, #444);
    flex-shrink: 0;
  }
  .tab {
    padding: 6px 18px;
    cursor: pointer;
    font-size: 0.88em;
    font-weight: 500;
    color: var(--vscode-descriptionForeground);
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    user-select: none;
    transition: color 0.1s;
  }
  .tab:hover { color: var(--vscode-foreground); }
  .tab.active {
    color: var(--vscode-foreground);
    border-bottom-color: var(--vscode-focusBorder, #0078d4);
  }

  /* ── Cost tab ── */
  .cost-section { margin-bottom: 28px; }
  .cost-section-title {
    font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--vscode-descriptionForeground); margin-bottom: 10px;
    padding-bottom: 4px; border-bottom: 1px solid var(--vscode-panel-border, #333);
  }
  .cost-total-card {
    background: var(--vscode-editorWidget-background, #252526);
    border: 1px solid var(--vscode-panel-border, #3c3c3c);
    border-radius: 6px;
    padding: 14px 18px;
    margin-bottom: 16px;
    display: flex; align-items: baseline; gap: 12px;
  }
  .cost-total-amount { font-size: 1.8em; font-weight: 700; color: #4ec9b0; }
  .cost-total-label { font-size: 0.82em; color: var(--vscode-descriptionForeground); }
  .cost-table { width: 100%; border-collapse: collapse; font-size: 0.85em; }
  .cost-table th {
    text-align: left; padding: 5px 10px;
    color: var(--vscode-descriptionForeground);
    font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.05em;
    border-bottom: 1px solid var(--vscode-panel-border, #333);
    font-weight: 500;
  }
  .cost-table td { padding: 6px 10px; border-bottom: 1px solid var(--vscode-panel-border, #2a2a2a); }
  .cost-table tr:last-child td { border-bottom: none; }
  .cost-table tr:hover td { background: var(--vscode-list-hoverBackground); }
  .cost-model-name { font-family: var(--vscode-editor-font-family, monospace); font-size: 0.9em; }
  .cost-amount { color: #4ec9b0; font-weight: 600; font-family: var(--vscode-editor-font-family, monospace); }
  .cost-note { font-size: 0.78em; color: var(--vscode-descriptionForeground); margin-top: 10px; opacity: 0.7; }

  /* ── Tab panes ── */
  .tab-pane { display: none; flex: 1; overflow-y: auto; padding: 16px; }
  .tab-pane.active { display: block; }

  .empty {
    padding: 32px 0;
    color: var(--vscode-descriptionForeground);
    text-align: center;
  }

  /* ── Agent card (user view) ── */
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

  /* ── Session ── */
  .session {
    border-left: 3px solid var(--vscode-panel-border, #555);
    margin-bottom: 16px;
    padding-left: 12px;
  }
  .session.status-completed  { border-color: #4ec9b0; }
  .session.status-failed     { border-color: #f48771; }
  .session.status-in_progress{ border-color: #dcdcaa; }
  .session.status-unknown    { border-color: #666; }

  .session-header {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }
  .session-id { font-family: var(--vscode-editor-font-family, monospace); font-size: 0.8em; color: var(--vscode-descriptionForeground); }
  .badge { font-size: 0.75em; padding: 1px 6px; border-radius: 10px; font-weight: 600; }
  .badge-completed   { background: #4ec9b030; color: #4ec9b0; }
  .badge-failed      { background: #f4877130; color: #f48771; }
  .badge-in_progress { background: #dcdcaa30; color: #dcdcaa; }
  .badge-unknown     { background: #66666630; color: #aaa; }

  .token-summary { font-size: 0.8em; color: var(--vscode-descriptionForeground); margin-bottom: 10px; }
  .token-summary span { margin-right: 10px; }

  /* ── Chat layout ── */
  .steps { display: flex; flex-direction: column; gap: 0; }
  /* Each turn is a full-width row; bubbles sit inside it */
  .chat-turn { display: flex; flex-direction: column; gap: 6px; margin-bottom: 24px; }
  .turn-ts {
    text-align: center;
    font-size: 0.72em;
    color: var(--vscode-descriptionForeground);
    margin: 6px 0 14px;
    opacity: 0.6;
  }

  /* Bubble wrappers — each takes the full chat column width so the bubble
     itself can control its own width via max-width without the wrapper
     collapsing around the bubble content. */
  .bubble-wrapper {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
  }
  .bubble-wrapper-user      { align-items: flex-end; }
  .bubble-wrapper-assistant { align-items: flex-start; }

  .bubble-role {
    font-size: 0.70em;
    color: var(--vscode-descriptionForeground);
    opacity: 0.65;
    margin-bottom: 4px;
    padding: 0 6px;
    user-select: none;
  }

  /* Shared bubble base */
  .bubble-user,
  .bubble-assistant {
    max-width: 72%;
    padding: 11px 18px;
    font-size: 0.9em;
    line-height: 1.65;
    white-space: pre-wrap;
    word-break: break-word;
    user-select: text;
  }

  .bubble-user {
    background: var(--vscode-button-background, #0078d4);
    color: var(--vscode-button-foreground, #fff);
    border-radius: 18px 18px 4px 18px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.22);
    cursor: default;
  }
  .bubble-user:hover { opacity: 0.95; }

  .bubble-assistant {
    background: var(--vscode-editor-inactiveSelectionBackground, #2a2d2e);
    border: 1px solid var(--vscode-panel-border, #3c3c3c);
    border-radius: 18px 18px 18px 4px;
    cursor: pointer;
  }
  .bubble-assistant:hover { border-color: var(--vscode-focusBorder, #0078d4); }

  /* Popover */
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
  .meta-key { color: var(--vscode-descriptionForeground); min-width: 90px; flex-shrink: 0; padding-top: 1px; font-size: 0.9em; }
  .meta-val { color: var(--vscode-foreground); word-break: break-all; line-height: 1.4; }
  .meta-val.mono { font-family: var(--vscode-editor-font-family, monospace); font-size: 0.88em; }

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

  /* Tool call pills */
  .tool-calls-block {
    display: flex; flex-direction: column; gap: 4px;
    align-self: flex-start; padding-left: 2px; margin: 4px 0;
  }
  .tool-calls-label {
    font-size: 0.72em; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--vscode-descriptionForeground); opacity: 0.7; margin-bottom: 2px;
  }
  .tool-pills { display: flex; flex-wrap: wrap; gap: 5px; padding: 0; }
  .tool-pill {
    display: inline-flex; align-items: center; gap: 5px;
    background: #dcdcaa18; border: 1px solid #dcdcaa40;
    border-radius: 12px; padding: 3px 10px;
    font-size: 0.78em; cursor: pointer; color: #dcdcaa; user-select: none;
  }
  .tool-pill:hover { background: #dcdcaa28; }
  .tool-pill-icon { font-size: 0.9em; }

  .tool-detail {
    display: none;
    background: var(--vscode-textCodeBlock-background, #1a1a1a);
    border: 1px solid #dcdcaa30; border-radius: 6px;
    padding: 10px; margin: 2px 0 4px; font-size: 0.82em;
  }
  .tool-detail.open { display: block; }

  .no-sessions { color: var(--vscode-descriptionForeground); font-size: 0.88em; padding: 8px 0; }
  .no-steps    { color: var(--vscode-descriptionForeground); font-size: 0.85em; font-style: italic; }
  .ts { color: var(--vscode-descriptionForeground); font-size: 0.78em; }

  /* ── Shared code block ── */
  .code-block {
    background: var(--vscode-textCodeBlock-background, #1e1e1e);
    border: 1px solid var(--vscode-panel-border, #333);
    border-radius: 3px; padding: 8px;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 0.82em; white-space: pre-wrap; word-break: break-all;
    max-height: 200px; overflow-y: auto; line-height: 1.4;
  }
  .tool-section { margin-top: 8px; }
  .tool-section h4 { font-size: 0.78em; text-transform: uppercase; letter-spacing: 0.05em; color: var(--vscode-descriptionForeground); margin-bottom: 4px; }

  /* ── Trajectories (span tree) ── */
  .span-tree { display: flex; flex-direction: column; gap: 0; }

  .span-section { margin-bottom: 24px; }
  .span-section-title {
    font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--vscode-descriptionForeground); margin-bottom: 10px;
    padding-bottom: 4px; border-bottom: 1px solid var(--vscode-panel-border, #333);
  }

  /* Each span row */
  .span-row {
    display: flex;
    align-items: center;
    height: 30px;
    margin-bottom: 2px;
    cursor: pointer;
    border-radius: 3px;
    transition: background 0.1s;
  }
  .span-row:hover { background: var(--vscode-list-hoverBackground); }
  .span-row.selected { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }

  /* Indent prefix */
  .span-indent { flex-shrink: 0; display: flex; align-items: center; }
  .span-connector { width: 20px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
  .span-connector-line { width: 1px; height: 100%; background: var(--vscode-panel-border, #555); }
  .span-expand-btn {
    width: 14px; height: 14px; border-radius: 2px;
    border: 1px solid var(--vscode-panel-border, #555);
    background: var(--vscode-editor-background);
    color: var(--vscode-foreground);
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; cursor: pointer; flex-shrink: 0;
    user-select: none;
  }
  .span-expand-btn:hover { background: var(--vscode-list-hoverBackground); }

  /* Span type badge */
  .span-kind {
    font-size: 0.72em; font-weight: 600; padding: 2px 7px;
    border-radius: 3px; margin-right: 8px; flex-shrink: 0;
    text-transform: capitalize; letter-spacing: 0.02em;
  }
  .kind-conversation { background: #7b52ab30; color: #c586c0; border: 1px solid #7b52ab50; }
  .kind-session      { background: #7b52ab30; color: #c586c0; border: 1px solid #7b52ab50; }
  .kind-invoke       { background: #0078d430; color: #569cd6; border: 1px solid #0078d450; }
  .kind-chat         { background: #008c6630; color: #4ec9b0; border: 1px solid #008c6650; }
  .kind-tool         { background: #7c6300; color: #dcdcaa; border: 1px solid #dcdcaa40; }
  .kind-user         { background: #444; color: #ccc; border: 1px solid #666; }

  /* Span name + model */
  .span-name { font-size: 0.88em; flex-shrink: 0; min-width: 0; }
  .span-model { font-size: 0.78em; color: var(--vscode-descriptionForeground); margin-left: 6px; flex-shrink: 0; }

  /* Status dot */
  .span-status { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; margin-left: 6px; }
  .status-dot-completed  { background: #4ec9b0; }
  .status-dot-failed     { background: #f48771; }
  .status-dot-in_progress{ background: #dcdcaa; }
  .status-dot-unknown    { background: #666; }

  /* Duration bar area */
  .span-bar-area {
    flex: 1; position: relative; height: 14px;
    margin: 0 12px;
    min-width: 80px;
  }
  .span-bar-track {
    position: absolute; top: 2px; left: 0; right: 0; bottom: 2px;
    background: var(--vscode-textCodeBlock-background, #1a1a1a);
    border-radius: 2px;
  }
  .span-bar {
    position: absolute; top: 0; bottom: 0;
    border-radius: 2px; min-width: 3px;
    opacity: 0.85;
  }
  .bar-conversation { background: #7b52abcc; }
  .bar-session      { background: #7b52abcc; }
  .bar-invoke       { background: #0078d4cc; }
  .bar-chat         { background: #4ec9b0cc; }
  .bar-tool         { background: #dcdcaa99; }
  .bar-user         { background: #888; }

  .span-duration {
    font-size: 0.78em; color: var(--vscode-descriptionForeground);
    white-space: nowrap; flex-shrink: 0; min-width: 44px; text-align: right;
    padding-right: 8px;
  }

  /* Token count (shown in Tokens view mode) */
  .span-tokens {
    font-size: 0.78em; color: var(--vscode-descriptionForeground);
    white-space: nowrap; flex-shrink: 0; min-width: 60px; text-align: right;
    padding-right: 8px;
  }

  /* Detail drawer under a selected span */
  .span-detail {
    display: none;
    background: var(--vscode-editorWidget-background, #252526);
    border: 1px solid var(--vscode-panel-border, #3c3c3c);
    border-radius: 4px;
    padding: 10px 14px;
    margin: 0 0 6px 40px;
    font-size: 0.82em;
    line-height: 1.5;
  }
  .span-detail.open { display: block; }
  .detail-row { display: flex; gap: 8px; margin-bottom: 4px; }
  .detail-key { color: var(--vscode-descriptionForeground); min-width: 100px; flex-shrink: 0; }
  .detail-val { color: var(--vscode-foreground); word-break: break-all; font-family: var(--vscode-editor-font-family, monospace); font-size: 0.9em; }
  .detail-content {
    margin-top: 8px; padding: 8px;
    background: var(--vscode-textCodeBlock-background, #1a1a1a);
    border-radius: 3px; white-space: pre-wrap; word-break: break-word;
    max-height: 160px; overflow-y: auto;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 0.9em;
  }

  /* Axis ruler */
  .span-axis {
    display: flex; margin-bottom: 8px; margin-left: 0;
    font-size: 0.72em; color: var(--vscode-descriptionForeground);
  }
  .axis-left-pad { flex-shrink: 0; }
  .axis-track { flex: 1; display: flex; justify-content: space-between; margin: 0 12px; }

  /* View mode toggle (Duration / Tokens) */
  .view-toggle {
    display: flex; gap: 0; margin-bottom: 12px;
    border: 1px solid var(--vscode-panel-border, #444);
    border-radius: 4px; overflow: hidden; width: fit-content;
  }
  .view-toggle-btn {
    padding: 4px 14px; font-size: 0.82em; cursor: pointer;
    background: transparent; border: none;
    color: var(--vscode-descriptionForeground);
    font-family: inherit;
  }
  .view-toggle-btn.active {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
  }
  .view-toggle-btn:hover:not(.active) { background: var(--vscode-list-hoverBackground); }
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

<div class="tab-bar">
  <div class="tab" id="tab-user" onclick="switchTab('user')">User view</div>
  <div class="tab" id="tab-traj" onclick="switchTab('traj')">Trajectories</div>
  <div class="tab" id="tab-cost" onclick="switchTab('cost')">Cost</div>
</div>

<div class="tab-pane active" id="pane-user"></div>
<div class="tab-pane" id="pane-traj"></div>
<div class="tab-pane" id="pane-cost"></div>

<script>
(function() {
  const agents = ${data};

  /* ── Utilities ── */
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

  function fmtTs(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  }
  function fmtMs(ms) {
    if (ms == null || isNaN(ms)) return '';
    if (ms < 1000) return Math.round(ms) + 'ms';
    return (ms / 1000).toFixed(2) + 's';
  }
  function makeCodeBlock(value) {
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    const d = el('div', {'class': 'code-block'});
    d.textContent = text;
    return d;
  }

  /* ── Tab switching ── */
  window.switchTab = function(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    document.getElementById('pane-' + name).classList.add('active');
  };

  /* ══════════════════════════════════════════════════════════════
     USER VIEW — chat bubble interface
  ══════════════════════════════════════════════════════════════ */

  function renderToolPill(tc) {
    const toolIcon = tc.name === 'web_search' ? '🌐'
                   : tc.name === 'file_search' ? '📂'
                   : tc.name === 'code_interpreter' ? '💻' : '🔧';
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

  function makePopover(contentFn) {
    const pop = el('div', {'class': 'bubble-popover'});
    contentFn(pop);
    return pop;
  }

  function renderUserBubble(step) {
    const bubble = el('div', {'class': 'bubble-user'});
    bubble.appendChild(document.createTextNode(step.content || '(empty)'));
    const wrapper = el('div', {'class': 'bubble-wrapper bubble-wrapper-user'});
    wrapper.appendChild(el('div', {'class': 'bubble-role'}, 'User'));
    wrapper.appendChild(bubble);
    return wrapper;
  }

  function renderAssistantBubble(step, llmStep, showViewTrace, agentNameFallback) {
    const bubble = el('div', {'class': 'bubble-assistant'});
    bubble.appendChild(document.createTextNode(step.content || '(empty)'));
    const agentLabel = llmStep?.agentName
      ? \`\${llmStep.agentName}\${llmStep.agentVersion ? ' v' + llmStep.agentVersion : ''}\`
      : (agentNameFallback || 'AI Assistant');
    const wrapper = el('div', {'class': 'bubble-wrapper bubble-wrapper-assistant'});
    wrapper.appendChild(el('div', {'class': 'bubble-role'}, agentLabel));
    wrapper.appendChild(bubble);

    if (!showViewTrace) { return wrapper; }

    const responseId = step.responseId ?? llmStep?.responseId ?? null;
    if (!responseId) { return wrapper; }

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
    wrapper.appendChild(pop);
    bubble.addEventListener('click', (e) => { e.stopPropagation(); pop.classList.toggle('open'); });
    document.addEventListener('click', () => pop.classList.remove('open'), { capture: false });
    return wrapper;
  }

  function renderStepsAsTurns(steps, showViewTrace, agentNameFallback) {
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

    const nodes = [];
    turns.forEach((turn, idx) => {
      const ts = turn.user?.createdAt ?? turn.llm?.startedAt ?? turn.assistant?.createdAt;
      if (idx === 0 && ts) {
        nodes.push(el('div', {'class': 'turn-ts'}, fmtTs(ts)));
      }
      const children = [];
      if (turn.user) { children.push(renderUserBubble(turn.user)); }
      if (turn.tools.length > 0) {
        const pillRow = el('div', {'class': 'tool-pills'});
        const details = [];
        for (const tc of turn.tools) {
          const [pill, detail] = renderToolPill(tc);
          pillRow.appendChild(pill);
          if (detail) { details.push(detail); }
        }
        children.push(el('div', {'class': 'tool-calls-block'},
          el('div', {'class': 'tool-calls-label'}, 'Tool Calls'),
          pillRow, ...details
        ));
      }
      if (turn.assistant) { children.push(renderAssistantBubble(turn.assistant, turn.llm, showViewTrace, agentNameFallback)); }
      nodes.push(el('div', {'class': 'chat-turn'}, ...children));
    });
    return nodes.filter(Boolean);
  }

  function renderSession(session, agentNameFallback) {
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
    const hasChatSteps = session.steps.some(s => s.kind === 'message');
    const showViewTrace = session.source === 'conversation';
    let stepsEl;
    if (session.steps.length === 0) {
      stepsEl = el('div', {'class': 'no-steps'}, 'No steps — start a conversation with the agent to generate trace data.');
    } else if (hasChatSteps) {
      stepsEl = el('div', {'class': 'steps'}, ...renderStepsAsTurns(session.steps, showViewTrace, agentNameFallback));
    } else {
      stepsEl = el('div', {'class': 'no-steps'}, 'No chat messages in this trace.');
    }
    return el('div', {'class': sessionCls},
      el('div', {'class': 'session-header'},
        el('span', {'class': 'session-id'}, session.id),
        el('span', {'class': badgeCls}, session.status),
        session.createdAt ? el('span', {'class': 'ts'}, fmtTs(session.createdAt)) : null
      ),
      tokenInfo,
      stepsEl
    );
  }

  function renderAgentUserView(agent) {
    const body = el('div', {'class': 'agent-body'});
    const chevron = el('span', {'class': 'chevron open'}, '▶');
    if (agent.sessions.length === 0) {
      body.appendChild(el('div', {'class': 'no-sessions'}, 'No sessions found.'));
    } else {
      agent.sessions.forEach(s => body.appendChild(renderSession(s, agent.name)));
    }
    const meta = [agent.model, agent.version ? \`v\${agent.version}\` : null].filter(Boolean).join(' · ');
    const header = el('div', {'class': 'agent-header'},
      chevron,
      el('span', {'class': 'agent-name'}, agent.name),
      meta ? el('span', {'class': 'agent-meta'}, meta) : null
    );
    header.addEventListener('click', () => {
      const open = body.classList.toggle('open-anim');
      chevron.classList.toggle('open', open);
    });
    body.classList.add('open-anim');
    chevron.classList.add('open');
    return el('div', {'class': 'agent-card'}, header, body);
  }

  function renderUserPane(agentList) {
    const pane = document.getElementById('pane-user');
    pane.innerHTML = '';
    if (!agentList || agentList.length === 0) {
      pane.appendChild(el('div', {'class': 'empty'}, 'No trace data available.'));
      return;
    }
    agentList.forEach(a => pane.appendChild(renderAgentUserView(a)));
  }

  /* ══════════════════════════════════════════════════════════════
     TRAJECTORIES — span-tree view with Gantt bars
  ══════════════════════════════════════════════════════════════ */

  // Build flat list of span rows from agents data
  function buildSpans(agentList) {
    // Each "span" has: { id, kind, name, model, status, startMs, endMs, durationMs, tokens, content, responseId, children: [] }
    const spans = [];

    for (const agent of (agentList || [])) {
      for (const session of (agent.sessions || [])) {
        // Group steps into turns (same as chat view)
        const turns = [];
        let cur = null;
        for (const step of session.steps) {
          if (step.kind === 'message' && step.role === 'user') {
            if (cur) { turns.push(cur); }
            cur = { user: step, llm: null, tools: [], assistant: null };
          } else if (step.kind === 'llm') {
            if (!cur) { cur = { user: null, llm: null, tools: [], assistant: null }; }
            cur.llm = step;
            cur.tools = step.toolCalls ?? [];
          } else if (step.kind === 'message' && step.role === 'assistant') {
            if (!cur) { cur = { user: null, llm: null, tools: [], assistant: null }; }
            cur.assistant = step;
            turns.push(cur);
            cur = null;
          }
        }
        if (cur) { turns.push(cur); }

        // Root span = "Conversation" or "Session"
        const isConv = session.source === 'conversation';
        const rootSpan = {
          id: session.id,
          kind: isConv ? 'conversation' : 'session',
          name: isConv ? session.id.slice(0, 28) + (session.id.length > 28 ? '…' : '') : (agent.name || 'Session'),
          model: agent.model ?? null,
          status: session.status,
          startMs: null,
          endMs: null,
          tokens: session.totalTokens ?? null,
          content: null,
          responseId: null,
          children: [],
          expanded: true,
        };

        for (let i = 0; i < turns.length; i++) {
          const turn = turns[i];
          const llm = turn.llm;

          // "Invoke Agent" span per turn (or just the agent name)
          const invokeStart = llm?.startedAt ? new Date(llm.startedAt).getTime() : null;
          const invokeDurMs = llm?.durationMs ?? null;
          const invokeEnd = (invokeStart != null && invokeDurMs != null) ? invokeStart + invokeDurMs : invokeStart;
          const invokeSpan = {
            id: \`invoke-\${session.id}-\${i}\`,
            kind: 'invoke',
            name: \`invoke_agent \${agent.name ?? 'agent'}\${agent.version ? ':' + agent.version : ''}\`,
            model: null,
            status: llm?.status ?? 'completed',
            startMs: invokeStart,
            endMs: invokeEnd,
            durationMs: invokeDurMs,
            tokens: llm?.tokenUsage ?? null,
            content: null,
            responseId: llm?.responseId ?? null,
            children: [],
            expanded: true,
          };

          // User message child (shown as a sibling before invoke, or inline)
          if (turn.user) {
            const uMs = turn.user.createdAt ? new Date(turn.user.createdAt).getTime() : invokeStart;
            invokeSpan.children.push({
              id: \`user-\${session.id}-\${i}\`,
              kind: 'user',
              name: (turn.user.content || '').slice(0, 60) + ((turn.user.content || '').length > 60 ? '…' : ''),
              model: null,
              status: 'completed',
              startMs: uMs,
              endMs: uMs,
              tokens: null,
              content: turn.user.content ?? '',
              responseId: null,
              children: [],
              expanded: false,
            });
          }

          // Tool call children
          for (const tc of (turn.tools || [])) {
            invokeSpan.children.push({
              id: \`tool-\${session.id}-\${i}-\${tc.id}\`,
              kind: 'tool',
              name: \`execute_tool \${tc.name}\`,
              model: null,
              status: tc.status,
              startMs: invokeStart,
              endMs: invokeStart,
              tokens: null,
              content: tc.input != null ? (typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input, null, 2)) : null,
              responseId: null,
              children: [],
              expanded: false,
            });
          }

          // Chat (LLM) child
          if (turn.assistant || llm) {
            const chatStart = llm?.startedAt ? new Date(llm.startedAt).getTime() : null;
            const chatDurMs = llm?.durationMs ?? null;
            const chatEnd = (chatStart != null && chatDurMs != null) ? chatStart + chatDurMs : chatStart;
            invokeSpan.children.push({
              id: \`chat-\${session.id}-\${i}\`,
              kind: 'chat',
              name: \`chat \${llm?.model ?? agent.model ?? 'model'}\`,
              model: llm?.model ?? agent.model ?? null,
              status: llm?.status ?? 'completed',
              startMs: chatStart,
              endMs: chatEnd,
              durationMs: chatDurMs,
              tokens: llm?.tokenUsage ?? null,
              content: turn.assistant?.content ?? '',
              responseId: llm?.responseId ?? null,
              children: [],
              expanded: false,
            });
          }

          rootSpan.children.push(invokeSpan);

          // Accumulate timing on root — span from earliest start to latest end
          if (invokeStart) {
            if (!rootSpan.startMs || invokeStart < rootSpan.startMs) { rootSpan.startMs = invokeStart; }
          }
          const invokeEndForRoot = invokeEnd ?? invokeStart;
          if (invokeEndForRoot) {
            if (!rootSpan.endMs || invokeEndForRoot > rootSpan.endMs) { rootSpan.endMs = invokeEndForRoot; }
          }
        }

        spans.push(rootSpan);
      }
    }
    return spans;
  }

  // Flatten span tree into ordered rows with depth
  function flattenSpans(spans) {
    const rows = [];
    function walk(span, depth, parentExpanded) {
      if (!parentExpanded) return;
      rows.push({ span, depth });
      if (span.expanded && span.children.length > 0) {
        for (const child of span.children) {
          walk(child, depth + 1, true);
        }
      }
    }
    for (const s of spans) { walk(s, 0, true); }
    return rows;
  }

  // Compute global time range for Gantt bars
  function getTimeRange(spans) {
    let minMs = Infinity, maxMs = -Infinity;
    function walk(span) {
      if (span.startMs) { minMs = Math.min(minMs, span.startMs); }
      if (span.endMs)   { maxMs = Math.max(maxMs, span.endMs); }
      for (const c of span.children) { walk(c); }
    }
    for (const s of spans) { walk(s); }
    if (!isFinite(minMs)) { return { minMs: 0, maxMs: 1000, totalMs: 1000 }; }
    const totalMs = Math.max(maxMs - minMs, 1);
    return { minMs, maxMs, totalMs };
  }

  let trajectorySpans = [];
  let viewMode = 'duration'; // 'duration' | 'tokens' | 'cost'
  let selectedSpanId = null;

  function renderTrajPane(agentList) {
    trajectorySpans = buildSpans(agentList);
    _drawTraj();
  }

  function _drawTraj() {
    const pane = document.getElementById('pane-traj');
    pane.innerHTML = '';

    if (trajectorySpans.length === 0) {
      pane.appendChild(el('div', {'class': 'empty'}, 'No trajectory data available.'));
      return;
    }

    // View mode toggle
    const toggle = el('div', {'class': 'view-toggle'},
      el('button', {
        'class': 'view-toggle-btn' + (viewMode === 'duration' ? ' active' : ''),
        'onclick': () => { viewMode = 'duration'; _drawTraj(); }
      }, 'Duration'),
      el('button', {
        'class': 'view-toggle-btn' + (viewMode === 'tokens' ? ' active' : ''),
        'onclick': () => { viewMode = 'tokens'; _drawTraj(); }
      }, 'Tokens'),
      el('button', {
        'class': 'view-toggle-btn' + (viewMode === 'cost' ? ' active' : ''),
        'onclick': () => { viewMode = 'cost'; _drawTraj(); }
      }, 'Cost')
    );
    pane.appendChild(toggle);

    // Legend for token/cost split bars
    if (viewMode === 'tokens' || viewMode === 'cost') {
      const legend = el('div', {'style': 'display:flex; align-items:center; gap:12px; padding:6px 0 2px 8px; font-size:0.78em; color:var(--vscode-descriptionForeground)'},
        el('span', {'style': 'display:flex; align-items:center; gap:4px'},
          el('span', {'style': 'width:10px; height:10px; background:#569cd6cc; border-radius:2px; display:inline-block'}),
          document.createTextNode(viewMode === 'tokens' ? 'Input tokens' : 'Input cost')
        ),
        el('span', {'style': 'display:flex; align-items:center; gap:4px'},
          el('span', {'style': 'width:10px; height:10px; background:#4ec9b0cc; border-radius:2px; display:inline-block'}),
          document.createTextNode(viewMode === 'tokens' ? 'Output tokens' : 'Output cost')
        )
      );
      pane.appendChild(legend);
    }

    const { minMs, totalMs } = getTimeRange(trajectorySpans);
    const rows = flattenSpans(trajectorySpans);

    // Estimate label width based on deepest indent (20px per level + kind badge ~80px + name)
    const LABEL_W = 320; // px for name column

    rows.forEach(({ span, depth }) => {
      // Expand button
      const hasChildren = span.children.length > 0;
      const expandBtn = hasChildren
        ? el('div', {'class': 'span-expand-btn'}, span.expanded ? '−' : '+')
        : el('div', {'style': 'width:14px; flex-shrink:0'});

      if (hasChildren) {
        expandBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          span.expanded = !span.expanded;
          _drawTraj();
        });
      }

      // Kind badge
      const kindLabel = {
        conversation: 'Conversation',
        session: 'Session',
        invoke: 'Invoke Agent',
        chat: 'Chat',
        tool: 'Execute Tool',
        user: 'User',
      }[span.kind] ?? span.kind;
      const kindBadge = el('span', {'class': 'span-kind kind-' + span.kind}, kindLabel);

      // Status dot — only for spans with meaningful execution status (not root or user messages)
      const showDot = span.kind === 'chat' || span.kind === 'tool' || span.kind === 'invoke';
      const dot = showDot ? el('div', {'class': 'span-status status-dot-' + span.status}) : null;

      // Name — strip redundant prefix from span.name so model isn't duplicated in modelEl
      const rawName = span.name ?? '';
      // Remove "invoke_agent ", "chat ", "execute_tool " prefixes — the kind badge already conveys that
      const displayName = rawName
        .replace(/^invoke_agent\s+/i, '')
        .replace(/^chat\s+/i, '')
        .replace(/^execute_tool\s+/i, '');
      const nameEl = el('span', {'class': 'span-name'}, displayName);
      // Only show modelEl if model differs from the display name (avoid "gpt-4.1-mini gpt-4.1-mini")
      const modelEl = (span.model && span.model !== displayName)
        ? el('span', {'class': 'span-model'}, span.model)
        : null;

      // Bar or tokens
      let barAreaEl, rightEl;
      if (viewMode === 'duration') {
        const barArea = el('div', {'class': 'span-bar-area'});
        const track = el('div', {'class': 'span-bar-track'});
        barArea.appendChild(track);

        let durLabel = '';
        if (span.startMs) {
          const leftPct = totalMs > 0 ? ((span.startMs - minMs) / totalMs) * 100 : 0;
          const rawEnd = span.endMs ?? span.startMs;
          const durMs = Math.max(rawEnd - span.startMs, 0);
          const widthPct = totalMs > 0 ? Math.max((durMs / totalMs) * 100, 0.8) : 0.8;
          const bar = el('div', {
            'class': 'span-bar bar-' + span.kind,
            'style': \`left:\${leftPct.toFixed(2)}%; width:\${widthPct.toFixed(2)}%\`,
            'title': durMs > 0 ? fmtMs(durMs) : (span.startMs > minMs ? '+' + fmtMs(span.startMs - minMs) : '')
          });
          barArea.appendChild(bar);
          // Prefer real duration; fall back to offset from conversation start
          if (durMs > 0) {
            durLabel = fmtMs(durMs);
          } else if (span.durationMs != null && span.durationMs > 0) {
            durLabel = fmtMs(span.durationMs);
          } else if (span.startMs > minMs) {
            durLabel = '+' + fmtMs(span.startMs - minMs);
          } else {
            durLabel = fmtMs(0);
          }
        }
        barAreaEl = barArea;
        rightEl = el('div', {'class': 'span-duration'}, durLabel);
      } else if (viewMode === 'tokens') {
        // Token bars
        barAreaEl = el('div', {'class': 'span-bar-area'});
        const t = span.tokens;
        if (t && t.total > 0) {
          const allTokenTotals = rows.map(r => r.span.tokens?.total ?? 0);
          const maxTok = Math.max(...allTokenTotals, 1);
          const wPct = (t.total / maxTok) * 100;
          const inPct = (t.input / t.total) * wPct;
          const outPct = (t.output / t.total) * wPct;

          const track = el('div', {'class': 'span-bar-track'});
          const inBar = el('div', {'class': 'span-bar', 'style': \`left:0; width:\${inPct.toFixed(2)}%; background:#569cd6cc\`});
          const outBar = el('div', {'class': 'span-bar', 'style': \`left:\${inPct.toFixed(2)}%; width:\${outPct.toFixed(2)}%; background:#4ec9b0cc\`});
          barAreaEl.appendChild(track);
          barAreaEl.appendChild(inBar);
          barAreaEl.appendChild(outBar);
          rightEl = el('div', {'class': 'span-tokens'}, \`\${t.total}t\`);
        } else {
          barAreaEl.appendChild(el('div', {'class': 'span-bar-track'}));
          rightEl = el('div', {'class': 'span-tokens'}, '');
        }
      } else {
        // Cost bars
        barAreaEl = el('div', {'class': 'span-bar-area'});
        const t = span.tokens;
        const pricing = t ? lookupPricing(span.model) : null;
        const spanCost = calcCost(t, pricing);

        if (spanCost != null && spanCost > 0) {
          const allCosts = rows.map(r => {
            const rt = r.span.tokens;
            const rp = rt ? lookupPricing(r.span.model) : null;
            return calcCost(rt, rp) ?? 0;
          });
          const maxCost = Math.max(...allCosts, 0.000001);
          const wPct = (spanCost / maxCost) * 100;
          // Split bar: input cost vs output cost (output is typically more expensive)
          const inputCost  = t ? (t.input  / 1_000_000) * (pricing?.input  ?? 0) : 0;
          const outputCost = t ? (t.output / 1_000_000) * (pricing?.output ?? 0) : 0;
          const totalCost  = inputCost + outputCost;
          const inPct  = totalCost > 0 ? (inputCost  / totalCost) * wPct : 0;
          const outPct = totalCost > 0 ? (outputCost / totalCost) * wPct : 0;

          const track  = el('div', {'class': 'span-bar-track'});
          const inBar  = el('div', {'class': 'span-bar', 'style': \`left:0; width:\${inPct.toFixed(2)}%; background:#569cd6cc\`});
          const outBar = el('div', {'class': 'span-bar', 'style': \`left:\${inPct.toFixed(2)}%; width:\${outPct.toFixed(2)}%; background:#4ec9b0cc\`});
          barAreaEl.appendChild(track);
          barAreaEl.appendChild(inBar);
          barAreaEl.appendChild(outBar);
          rightEl = el('div', {'class': 'span-tokens'}, fmtCost(spanCost));
        } else {
          barAreaEl.appendChild(el('div', {'class': 'span-bar-track'}));
          rightEl = el('div', {'class': 'span-tokens'}, spanCost === 0 ? '—' : '');
        }
      }

      // Indent: 20px per level, plus expand btn
      const indentPad = el('div', {'class': 'span-indent', 'style': \`padding-left:\${depth * 20}px\`});

      const isSelected = span.id === selectedSpanId;
      const rowChildren = [indentPad, expandBtn, kindBadge, dot, nameEl, modelEl, barAreaEl, rightEl].filter(Boolean);
      const rowEl = el('div', {'class': 'span-row' + (isSelected ? ' selected' : '')}, ...rowChildren);
      rowEl.addEventListener('click', () => {
        selectedSpanId = span.id === selectedSpanId ? null : span.id;
        _drawTraj();
      });
      pane.appendChild(rowEl);

      // Detail drawer for selected span
      if (isSelected) {
        const drawer = el('div', {'class': 'span-detail open'});
        const addRow = (key, val) => {
          if (val == null || val === '') return;
          drawer.appendChild(el('div', {'class': 'detail-row'},
            el('div', {'class': 'detail-key'}, key),
            el('div', {'class': 'detail-val'}, String(val))
          ));
        };
        addRow('Status', span.status);
        if (span.responseId) { addRow('Response ID', span.responseId); }
        if (span.model) { addRow('Model', span.model); }
        if (span.tokens) {
          addRow('Tokens', \`\${span.tokens.input} in + \${span.tokens.output} out = \${span.tokens.total} total\`);
        }
        if (span.content) {
          drawer.appendChild(el('div', {'class': 'detail-content'}, span.content));
        }
        pane.appendChild(drawer);
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════
     COST TAB
  ══════════════════════════════════════════════════════════════ */

  // Pricing per million tokens (input / output) for known Azure OpenAI / OpenAI models.
  // Prices are approximate USD list prices as of mid-2025 — shown with a disclaimer.
  const MODEL_PRICING = {
    // GPT-4.1 family
    'gpt-4.1':                 { input: 2.00,  output: 8.00  },
    'gpt-4.1-mini':            { input: 0.40,  output: 1.60  },
    'gpt-4.1-nano':            { input: 0.10,  output: 0.40  },
    // GPT-4o family
    'gpt-4o':                  { input: 5.00,  output: 15.00 },
    'gpt-4o-mini':             { input: 0.15,  output: 0.60  },
    'gpt-4o-2024-11-20':       { input: 2.50,  output: 10.00 },
    'gpt-4o-2024-08-06':       { input: 2.50,  output: 10.00 },
    'gpt-4o-mini-2024-07-18':  { input: 0.15,  output: 0.60  },
    // GPT-4 Turbo
    'gpt-4-turbo':             { input: 10.00, output: 30.00 },
    'gpt-4-turbo-2024-04-09':  { input: 10.00, output: 30.00 },
    // o-series
    'o1':                      { input: 15.00, output: 60.00 },
    'o1-mini':                 { input: 3.00,  output: 12.00 },
    'o3':                      { input: 10.00, output: 40.00 },
    'o3-mini':                 { input: 1.10,  output: 4.40  },
    'o4-mini':                 { input: 1.10,  output: 4.40  },
  };

  function lookupPricing(model) {
    if (!model) return null;
    const lower = model.toLowerCase();
    // Exact match first
    if (MODEL_PRICING[lower]) return MODEL_PRICING[lower];
    // Prefix match (e.g. "gpt-4.1-mini-2025-04-14" matches "gpt-4.1-mini")
    for (const key of Object.keys(MODEL_PRICING)) {
      if (lower.startsWith(key)) return MODEL_PRICING[key];
    }
    return null;
  }

  function calcCost(tokens, pricing) {
    if (!tokens || !pricing) return null;
    return (tokens.input / 1_000_000) * pricing.input
         + (tokens.output / 1_000_000) * pricing.output;
  }

  function fmtCost(usd) {
    if (usd == null) return '—';
    if (usd < 0.000001) return '$0.000000';
    if (usd < 0.001) return '$' + usd.toFixed(6);
    if (usd < 0.01)  return '$' + usd.toFixed(5);
    if (usd < 1)     return '$' + usd.toFixed(4);
    return '$' + usd.toFixed(3);
  }

  function renderCostPane(agentList) {
    const pane = document.getElementById('pane-cost');
    pane.innerHTML = '';

    // Collect per-model token totals from all LLM steps across all agents/sessions
    const byModel = new Map(); // model -> { input, output, turns }

    for (const agent of (agentList || [])) {
      for (const session of (agent.sessions || [])) {
        for (const step of (session.steps || [])) {
          if (step.kind === 'llm' && step.tokenUsage) {
            const model = step.model ?? agent.model ?? 'unknown';
            if (!byModel.has(model)) { byModel.set(model, { input: 0, output: 0, turns: 0 }); }
            const e = byModel.get(model);
            e.input  += step.tokenUsage.input;
            e.output += step.tokenUsage.output;
            e.turns++;
          }
        }
      }
    }

    if (byModel.size === 0) {
      pane.appendChild(el('div', {'class': 'empty'}, 'No token usage data available. Open a conversation to populate cost data.'));
      return;
    }

    // Compute per-model cost and grand total
    let grandTotal = 0;
    let hasUnknown = false;
    const rows = [];

    for (const [model, tok] of byModel) {
      const pricing = lookupPricing(model);
      const cost = calcCost(tok, pricing);
      if (cost != null) { grandTotal += cost; } else { hasUnknown = true; }
      rows.push({ model, tok, pricing, cost });
    }

    // Grand total card
    pane.appendChild(el('div', {'class': 'cost-total-card'},
      el('div', {'class': 'cost-total-amount'}, fmtCost(grandTotal)),
      el('div', {'class': 'cost-total-label'}, 'estimated total cost' + (hasUnknown ? ' (some models unpriced)' : ''))
    ));

    // Per-model table
    const thead = el('thead', {},
      el('tr', {},
        el('th', {}, 'Model'),
        el('th', {}, 'Turns'),
        el('th', {}, 'Input tokens'),
        el('th', {}, 'Output tokens'),
        el('th', {}, 'Total tokens'),
        el('th', {}, 'Est. cost')
      )
    );
    const tbody = el('tbody', {});

    for (const { model, tok, cost } of rows) {
      tbody.appendChild(el('tr', {},
        el('td', {}, el('span', {'class': 'cost-model-name'}, model)),
        el('td', {}, String(tok.turns)),
        el('td', {}, tok.input.toLocaleString()),
        el('td', {}, tok.output.toLocaleString()),
        el('td', {}, (tok.input + tok.output).toLocaleString()),
        el('td', {}, el('span', {'class': 'cost-amount'}, fmtCost(cost)))
      ));
    }

    const table = el('table', {'class': 'cost-table'}, thead, tbody);
    pane.appendChild(el('div', {'class': 'cost-section'},
      el('div', {'class': 'cost-section-title'}, 'Per-model breakdown'),
      table
    ));

    pane.appendChild(el('div', {'class': 'cost-note'},
      '* Prices are approximate USD list prices per 1M tokens as of mid-2025. ' +
      'Actual costs may vary based on your Azure/OpenAI subscription, region, and discounts. ' +
      'Models not in the pricing table show "—".'
    ));
  }

  /* ── Main render ── */
  function render(agentList) {
    renderUserPane(agentList);
    renderTrajPane(agentList);
    renderCostPane(agentList);
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

  // Default: User view tab active
  switchTab('user');

  render(agents);
  document.getElementById('lastUpdated').textContent = 'Updated ' + new Date().toLocaleTimeString();

  window.addEventListener('message', e => {
    if (e.data?.type === 'update') {
      render(e.data.agents);
      setLoading(false);
      document.getElementById('lastUpdated').textContent = 'Updated ' + new Date().toLocaleTimeString();
      if (e.data.highlightResponseId) {
        // Switch to Trajectories tab and select the matching span
        switchTab('traj');
        const respId = e.data.highlightResponseId;
        // Find and select the chat span with this responseId
        const allSpans = [];
        function collectSpans(spans) {
          for (const s of spans) {
            allSpans.push(s);
            if (s.children) collectSpans(s.children);
          }
        }
        collectSpans(trajectorySpans);
        const match = allSpans.find(s => s.responseId === respId);
        if (match) {
          selectedSpanId = match.id;
          // Expand ancestors
          function expandToSpan(spans, targetId) {
            for (const s of spans) {
              if (s.id === targetId) return true;
              if (s.children && expandToSpan(s.children, targetId)) {
                s.expanded = true;
                return true;
              }
            }
            return false;
          }
          expandToSpan(trajectorySpans, match.id);
          _drawTraj();
          // Scroll highlighted row into view after render
          setTimeout(() => {
            const sel = document.querySelector('.span-row.selected');
            if (sel) sel.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 50);
        }
      }
    } else if (e.data?.type === 'loading') {
      setLoading(true);
    }
  });
})();
</script>
</body>
</html>`;
}
