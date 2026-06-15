import * as vscode from "vscode";
import { storeApiKey, getConfig } from "../config";
import { createClient } from "../client";
import { getApiKey } from "../config";
import { setConnectionState } from "./connectionState";

let _panel: vscode.WebviewPanel | undefined;

export function openOnboardingPanel(context: vscode.ExtensionContext): void {
  if (_panel) {
    _panel.reveal(vscode.ViewColumn.One);
    return;
  }

  _panel = vscode.window.createWebviewPanel(
    "foundryOnboarding",
    "Foundry Trace Inspector — Setup",
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  const config = getConfig();
  _panel.webview.html = buildHtml(config.projectEndpoint, config.authMethod);

  _panel.webview.onDidReceiveMessage(
    async (msg) => {
      switch (msg.type) {
        case "saveEndpoint": {
          const endpoint = (msg.endpoint as string).trim();
          await vscode.workspace
            .getConfiguration("aiFoundryAgentInspector")
            .update("projectEndpoint", endpoint, vscode.ConfigurationTarget.Global);
          _panel?.webview.postMessage({ type: "endpointSaved" });
          break;
        }
        case "saveAuthMethod": {
          await vscode.workspace
            .getConfiguration("aiFoundryAgentInspector")
            .update("authMethod", msg.authMethod, vscode.ConfigurationTarget.Global);
          _panel?.webview.postMessage({ type: "authMethodSaved" });
          break;
        }
        case "saveApiKey": {
          const key = (msg.apiKey as string).trim();
          if (!key) {
            _panel?.webview.postMessage({ type: "error", message: "API key cannot be empty." });
            return;
          }
          await storeApiKey(context.secrets, key);
          _panel?.webview.postMessage({ type: "apiKeySaved" });
          break;
        }
        case "testConnection": {
          _panel?.webview.postMessage({ type: "testing" });
          try {
            const cfg = getConfig();
            if (!cfg.projectEndpoint) {
              _panel?.webview.postMessage({ type: "testResult", ok: false, message: "No project endpoint configured." });
              return;
            }
            const apiKey = cfg.authMethod === "apiKey"
              ? await getApiKey(context.secrets)
              : undefined;
            if (cfg.authMethod === "apiKey" && !apiKey) {
              _panel?.webview.postMessage({ type: "testResult", ok: false, message: "Auth method is API key but no key is stored. Save your API key first." });
              return;
            }
            const client = createClient(cfg, apiKey);
            const agents: string[] = [];
            for await (const agent of client.agents.list()) {
              agents.push((agent as unknown as { display_name?: string; name?: string }).display_name
                ?? (agent as unknown as { name?: string }).name
                ?? "unnamed");
            }
            setConnectionState({ status: "connected", errorMessage: undefined });
            _panel?.webview.postMessage({
              type: "testResult",
              ok: true,
              message: `Connected! Found ${agents.length} agent${agents.length === 1 ? "" : "s"}: ${agents.join(", ") || "(none yet)"}`,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setConnectionState({ status: "error", errorMessage: message });
            _panel?.webview.postMessage({ type: "testResult", ok: false, message });
          }
          break;
        }
        case "openSettings": {
          await vscode.commands.executeCommand(
            "workbench.action.openSettings",
            "aiFoundryAgentInspector"
          );
          break;
        }
        case "disconnect": {
          await vscode.workspace
            .getConfiguration("aiFoundryAgentInspector")
            .update("projectEndpoint", "", vscode.ConfigurationTarget.Global);
          await vscode.workspace
            .getConfiguration("aiFoundryAgentInspector")
            .update("authMethod", "entraId", vscode.ConfigurationTarget.Global);
          await context.secrets.delete("aiFoundryAgentInspector.apiKey");
          _panel?.webview.postMessage({ type: "disconnected" });
          break;
        }
      }
    },
    null,
    context.subscriptions
  );

  _panel.onDidDispose(() => { _panel = undefined; }, null, context.subscriptions);
}

function buildHtml(currentEndpoint: string, currentAuthMethod: string): string {
  const endpoint = currentEndpoint.replace(/"/g, "&quot;");
  const isApiKey = currentAuthMethod === "apiKey";

  return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Foundry Trace Inspector — Setup</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: var(--vscode-font-size, 13px);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 32px 40px;
    max-width: 680px;
  }
  h1 { font-size: 1.3em; font-weight: 700; margin-bottom: 6px; }
  .subtitle { color: var(--vscode-descriptionForeground); margin-bottom: 10px; font-size: 0.92em; }
  .privacy-note {
    font-size: 0.82em;
    color: var(--vscode-descriptionForeground);
    background: var(--vscode-textBlockQuote-background, #1e1e2e);
    border-left: 3px solid #4ec9b0;
    padding: 8px 12px;
    border-radius: 3px;
    margin-bottom: 28px;
    line-height: 1.5;
  }

  .step {
    border: 1px solid var(--vscode-panel-border, #444);
    border-radius: 6px;
    margin-bottom: 16px;
    overflow: hidden;
  }
  .step-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: var(--vscode-sideBar-background, #1e1e1e);
    cursor: default;
  }
  .step-num {
    width: 24px; height: 24px;
    border-radius: 50%;
    background: var(--vscode-button-background, #0078d4);
    color: var(--vscode-button-foreground, #fff);
    font-size: 0.8em;
    font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .step-num.done { background: #4ec9b0; }
  .step-title { font-weight: 600; font-size: 0.95em; }
  .step-body { padding: 16px; display: flex; flex-direction: column; gap: 10px; }

  label { font-size: 0.88em; color: var(--vscode-descriptionForeground); display: block; margin-bottom: 4px; }
  input[type="text"], input[type="password"] {
    width: 100%;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, #555);
    border-radius: 3px;
    padding: 6px 10px;
    font-size: 0.9em;
    font-family: inherit;
    outline: none;
  }
  input:focus { border-color: var(--vscode-focusBorder, #0078d4); }

  .radio-group { display: flex; gap: 20px; }
  .radio-group label {
    display: flex; align-items: center; gap: 6px;
    color: var(--vscode-foreground);
    cursor: pointer;
    margin: 0;
  }

  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none; border-radius: 3px;
    padding: 6px 14px;
    font-size: 0.88em;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
  }
  .btn:hover { background: var(--vscode-button-hoverBackground); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-secondary {
    background: var(--vscode-button-secondaryBackground, #3a3d41);
    color: var(--vscode-button-secondaryForeground, #ccc);
  }
  .btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground, #45484e); }

  .hint {
    font-size: 0.82em;
    color: var(--vscode-descriptionForeground);
    line-height: 1.5;
  }
  .hint code {
    font-family: var(--vscode-editor-font-family, monospace);
    background: var(--vscode-textCodeBlock-background, #1e1e1e);
    padding: 1px 4px;
    border-radius: 2px;
  }

  .status-msg {
    font-size: 0.85em;
    padding: 8px 12px;
    border-radius: 4px;
    display: none;
  }
  .status-msg.visible { display: block; }
  .status-ok  { background: #4ec9b015; border: 1px solid #4ec9b040; color: #4ec9b0; }
  .status-err { background: #f4877115; border: 1px solid #f4877140; color: #f48771; }
  .status-info { background: #569cd615; border: 1px solid #569cd640; color: #9cdcfe; }

  .row { display: flex; align-items: flex-start; gap: 10px; }
  .row input { flex: 1; }

  .api-key-section { display: none; flex-direction: column; gap: 10px; }
  .api-key-section.visible { display: flex; }

  .divider { border: none; border-top: 1px solid var(--vscode-panel-border, #444); margin: 4px 0; }
</style>
</head>
<body>

<h1>🔍 Foundry Trace Inspector</h1>
<p class="subtitle">Connect to your Azure AI Foundry project to browse conversations and inspect agent traces.</p>
<p class="privacy-note">🔒 Your API keys and project data are never sent to any server outside your own Azure endpoint. Nothing is stored or logged by this extension beyond what VS Code persists locally.</p>

<!-- Step 1: Endpoint -->
<div class="step" id="step1">
  <div class="step-header">
    <div class="step-num" id="num1">1</div>
    <span class="step-title">Project Endpoint</span>
  </div>
  <div class="step-body">
    <div>
      <label for="endpointInput">Paste your Foundry project endpoint URL</label>
      <div class="row">
        <input type="text" id="endpointInput" placeholder="https://<hub>.services.ai.azure.com/api/projects/<project>"
          value="${endpoint}" />
        <button class="btn" onclick="saveEndpoint()">Save</button>
      </div>
    </div>
    <p class="hint">
      Find it in the Foundry portal → your project → <strong>Overview</strong> → copy <em>Project endpoint</em>.
    </p>
    <div class="status-msg" id="endpointStatus"></div>
  </div>
</div>

<!-- Step 2: Auth -->
<div class="step" id="step2">
  <div class="step-header">
    <div class="step-num" id="num2">2</div>
    <span class="step-title">Authentication</span>
  </div>
  <div class="step-body">
    <div>
      <label>How do you authenticate with Azure?</label>
      <div class="radio-group">
        <label>
          <input type="radio" name="authMethod" value="apiKey" ${isApiKey ? "checked" : ""}
            onchange="onAuthChange(this.value)" />
          API Key
        </label>
        <label>
          <input type="radio" name="authMethod" value="entraId" ${!isApiKey ? "checked" : ""}
            onchange="onAuthChange(this.value)" />
          Entra ID / az login
        </label>
      </div>
      <p class="hint" id="entraHint" style="${!isApiKey ? "" : "display:none"}">
        Requires the Azure CLI — run <code>brew install azure-cli</code> then <code>az login</code> in a terminal before testing the connection.
      </p>
    </div>

    <div class="api-key-section ${isApiKey ? "visible" : ""}" id="apiKeySection">
      <hr class="divider">
      <div>
        <label for="apiKeyInput">API Key</label>
        <div class="row">
          <input type="password" id="apiKeyInput" placeholder="Paste your API key — stored securely, never on disk" />
          <button class="btn" onclick="saveApiKey()">Save Key</button>
        </div>
      </div>
      <p class="hint">
        Found in the Foundry portal → your project → <strong>Overview</strong> → <em>API keys</em>.<br>
        Stored in VS Code SecretStorage — never written to <code>settings.json</code>.
      </p>
      <div class="status-msg" id="apiKeyStatus"></div>
    </div>

    <div class="status-msg" id="authStatus"></div>
  </div>
</div>

<!-- Step 3: Test -->
<div class="step" id="step3">
  <div class="step-header">
    <div class="step-num" id="num3">3</div>
    <span class="step-title">Test Connection</span>
  </div>
  <div class="step-body">
    <p class="hint">Verify your endpoint and credentials by connecting to your Foundry project.</p>
    <div>
      <button class="btn" id="testBtn" onclick="testConnection()">⚡ Test Connection</button>
    </div>
    <div class="status-msg" id="testStatus"></div>
  </div>
</div>

<!-- Disconnect -->
<div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--vscode-panel-border, #444);">
  <p class="hint" style="margin-bottom: 10px;">Remove your saved endpoint and API key to disconnect from this project.</p>
  <div id="disconnectConfirm" style="display:none; margin-bottom: 10px;">
    <p class="hint" style="margin-bottom: 8px; color: #f48771;">This will clear your saved endpoint and API key. Are you sure?</p>
    <div style="display:flex; gap:8px;">
      <button class="btn" style="background:#c72e2e;" onclick="confirmDisconnect()">Yes, disconnect</button>
      <button class="btn btn-secondary" onclick="cancelDisconnect()">Cancel</button>
    </div>
  </div>
  <button class="btn btn-secondary" id="disconnectBtn" onclick="disconnect()">⊘ Disconnect / Reset</button>
  <div class="status-msg" id="disconnectStatus" style="margin-top: 10px;"></div>
</div>

<script>
const vscode = acquireVsCodeApi();

function saveEndpoint() {
  const val = document.getElementById('endpointInput').value.trim();
  if (!val) { showStatus('endpointStatus', 'err', 'Endpoint cannot be empty.'); return; }
  if (!val.startsWith('https://')) { showStatus('endpointStatus', 'err', 'Endpoint must start with https://'); return; }
  vscode.postMessage({ type: 'saveEndpoint', endpoint: val });
}

function onAuthChange(val) {
  vscode.postMessage({ type: 'saveAuthMethod', authMethod: val });
  document.getElementById('apiKeySection').classList.toggle('visible', val === 'apiKey');
  document.getElementById('entraHint').style.display = val === 'entraId' ? '' : 'none';
}

function disconnect() {
  document.getElementById('disconnectBtn').style.display = 'none';
  document.getElementById('disconnectConfirm').style.display = 'block';
}

function confirmDisconnect() {
  document.getElementById('disconnectConfirm').style.display = 'none';
  vscode.postMessage({ type: 'disconnect' });
}

function cancelDisconnect() {
  document.getElementById('disconnectConfirm').style.display = 'none';
  document.getElementById('disconnectBtn').style.display = '';
}

function saveApiKey() {
  const val = document.getElementById('apiKeyInput').value.trim();
  if (!val) { showStatus('apiKeyStatus', 'err', 'API key cannot be empty.'); return; }
  vscode.postMessage({ type: 'saveApiKey', apiKey: val });
}

function testConnection() {
  const btn = document.getElementById('testBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Testing…';
  showStatus('testStatus', 'info', 'Connecting…');
  vscode.postMessage({ type: 'testConnection' });
}

function showStatus(id, type, msg) {
  const el = document.getElementById(id);
  el.className = 'status-msg visible status-' + type;
  el.textContent = msg;
}

function markDone(numId) {
  const el = document.getElementById(numId);
  el.classList.add('done');
  el.textContent = '✓';
}

window.addEventListener('message', e => {
  const msg = e.data;
  switch (msg.type) {
    case 'endpointSaved':
      showStatus('endpointStatus', 'ok', 'Endpoint saved.');
      markDone('num1');
      break;
    case 'authMethodSaved':
      showStatus('authStatus', 'ok', 'Auth method saved.');
      markDone('num2');
      break;
    case 'apiKeySaved':
      showStatus('apiKeyStatus', 'ok', 'API key saved securely.');
      document.getElementById('apiKeyInput').value = '';
      markDone('num2');
      break;
    case 'testing':
      break;
    case 'testResult': {
      const btn = document.getElementById('testBtn');
      btn.disabled = false;
      btn.textContent = '⚡ Test Connection';
      if (msg.ok) {
        showStatus('testStatus', 'ok', '✓ ' + msg.message);
        markDone('num3');
      } else {
        showStatus('testStatus', 'err', '✗ ' + msg.message);
      }
      break;
    }
    case 'error':
      showStatus('testStatus', 'err', msg.message);
      break;
    case 'disconnected':
      document.getElementById('endpointInput').value = '';
      document.getElementById('disconnectBtn').style.display = '';
      showStatus('disconnectStatus', 'ok', 'Disconnected. Endpoint and API key cleared.');
      break;
  }
});
</script>
</body>
</html>`;
}
