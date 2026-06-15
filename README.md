# AI Foundry Agent Inspector

A VS Code extension for visualizing and debugging **Azure AI Foundry Agent Service** runs directly in your editor — no portal hopping, no throwaway scripts.

> ⚠️ **Status: Early development.** Not yet published to the VS Code Marketplace. Expect breaking changes.

## Why

Debugging agent behavior in Azure AI Foundry (tool calls, multi-step reasoning, token usage) currently means digging through the Foundry portal. **AI Foundry Agent Inspector** brings that trace data into VS Code as an interactive timeline, so you can inspect exactly what your agent did — step by step, tool call by tool call — while you're in your code.

## Features

- 🔌 Connect to your Azure AI Foundry project via **API key** or **Entra ID** (`az login`)
- 🕒 **Interactive timeline** of agent responses — LLM turns, tool calls with inputs/outputs, user and assistant messages
- 📊 **Token usage chart** — stacked bar chart showing input vs output tokens per LLM turn at a glance
- 🔍 Expandable steps — inspect raw JSON inputs/outputs for every tool call
- 💾 Response IDs saved to settings — enter once, pre-filled on every subsequent run
- 🔄 One-click refresh to re-fetch the latest trace data

## Status / Roadmap

- [x] Phase 1 — Project scaffold, authentication, raw trace listing
- [x] Phase 2 — Trace data normalization (`TraceAgent` / `TraceSession` / `TraceStep` model)
- [x] Phase 3 — Timeline visualization webview (collapsible steps, token chart)
- [ ] Phase 4 — Error handling, polish, icon, docs
- [ ] Phase 5 — Marketplace publish

---

## Setup

### Prerequisites

- **Node.js** 18+ and **npm**
- **VS Code** 1.85+
- An **Azure AI Foundry** project with at least one agent at [ai.azure.com](https://ai.azure.com)
- Either:
  - **Entra ID** auth: Azure CLI installed and `az login` completed
  - **API key** auth: an API key for your Foundry project

### Install & build

```bash
npm install
npm run compile
```

### Run in development

Press **F5** in VS Code to launch the Extension Development Host.

---

## Configuration

Open VS Code Settings (`Cmd/Ctrl+Shift+P` → `Preferences: Open Settings (UI)`) and search for **AI Foundry Agent Inspector**.

| Setting | Description | Default |
|---------|-------------|---------|
| `aiFoundryAgentInspector.projectEndpoint` | Your Foundry project endpoint URL | — |
| `aiFoundryAgentInspector.authMethod` | `entraId` or `apiKey` | `entraId` |
| `aiFoundryAgentInspector.maxRunsToList` | Max sessions to fetch when listing runs | `20` |
| `aiFoundryAgentInspector.responseIds` | Saved response IDs (`resp_...`) for Show Trace | `[]` |

> **Finding your endpoint:** Foundry portal → your project → Overview → copy the "Project endpoint". It looks like `https://<hub>.services.ai.azure.com/api/projects/<project>`.

### Store your API key (API key auth only)

1. Set `authMethod` to `apiKey` in settings
2. Run `Foundry Trace: Set API Key` (`Cmd/Ctrl+Shift+P`)
3. Paste your key — stored securely in VS Code **SecretStorage**, never in `settings.json`

To remove: `Foundry Trace: Clear API Key`

---

## Usage

### Show a trace

1. In the Foundry portal, open your agent → **Traces** tab → copy a `resp_...` response ID
2. `Cmd/Ctrl+Shift+P` → **Foundry Trace: Show Trace**
3. First run: choose **Add new response ID…** and paste the `resp_...` ID. It's saved automatically.
4. Subsequent runs: your saved IDs appear pre-selected — just press Enter

The timeline webview opens showing:
- **LLM turns** (🧠) with token counts and any tool calls made
- **Tool calls** (🔧) with expandable JSON input and output
- **User messages** (👤) and **assistant replies** (🤖)
- **Token usage chart** showing input vs output tokens per turn

### Other commands

| Command | Description |
|---------|-------------|
| `Foundry Trace: Connect to Project` | Validate connection by listing agents |
| `Foundry Trace: List Recent Runs` | Dump agents and sessions as raw JSON to the output channel |
| `Foundry Trace: Set API Key` | Store an API key in SecretStorage |
| `Foundry Trace: Clear API Key` | Remove the stored API key |

---

## How response IDs work

The Foundry portal uses OpenAI's **Responses API** internally. Each agent reply generates a `resp_...` response ID visible in the portal's Traces tab. This extension fetches those responses directly via the same API.

Multiple responses in the same conversation are linked via `previous_response_id`, so the extension automatically chains them into a single session view when you load multiple IDs from the same conversation.

There is currently no public API to list all response IDs — you need to copy them from the portal Traces tab once, after which the extension remembers them.

---

## Project structure

```
src/
  extension.ts          # Entry point — registers commands
  config.ts             # Settings + SecretStorage helpers
  client.ts             # AIProjectClient factory (API key + Entra ID auth)
  outputChannel.ts      # Shared output channel singleton
  commands/
    connect.ts          # "Connect to Project"
    listRuns.ts         # "List Recent Runs"
    apiKey.ts           # Set/clear API key
    showTrace.ts        # "Show Trace" — fetch responses, open webview
  trace/
    model.ts            # Normalized data types (TraceAgent, TraceSession, TraceStep)
    normalizer.ts       # normalizeFromResponses() — Responses API → TraceAgent[]
  webview/
    tracePanel.ts       # Webview panel HTML/CSS/JS — timeline + token chart
```

---

## Packaging

When ready for marketplace:

```bash
npm install -g @vscode/vsce
vsce package
```

This produces a `.vsix` installable via `Extensions: Install from VSIX…`.

---

## SDK notes

Uses [`@azure/ai-projects`](https://www.npmjs.com/package/@azure/ai-projects) v2.x and [`openai`](https://www.npmjs.com/package/openai) for the Responses API.

Key auth pattern for API key (the SDK only accepts `TokenCredential`):

```typescript
// NoOpCredential returns a dummy token; a perCall policy overwrites
// Authorization with api-key before each request hits the wire.
new AIProjectClient(endpoint, new NoOpCredential(), {
  additionalPolicies: [{
    policy: { sendRequest(req, next) {
      req.headers.set("api-key", apiKey);
      req.headers.delete("Authorization");
      return next(req);
    }},
    position: "perCall",
  }]
});
```

## Requirements

- An [Azure AI Foundry](https://ai.azure.com) project with at least one Agent
- Node.js 18+ and VS Code 1.85+

## License

[MIT](./LICENSE)

## Contributing

Early development — issues and discussion welcome.
