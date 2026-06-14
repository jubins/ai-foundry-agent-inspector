# AI Foundry Agent Inspector

A VS Code extension for visualizing and debugging **Azure AI Foundry Agent Service** runs directly in your editor — no portal hopping, no throwaway scripts.

> ⚠️ **Status: Early development.** This project is under active development and not yet published to the VS Code Marketplace. Expect breaking changes.

## Why

Debugging agent behavior in Azure AI Foundry (tool calls, multi-step reasoning, handoffs, token usage) currently means digging through the Foundry portal or writing one-off scripts to inspect run traces. **AI Foundry Agent Inspector** brings that trace data into VS Code as an interactive timeline, so you can see exactly what your agent did, step by step, while you're in your code.

## Planned Features

- 🔌 Connect to your Azure AI Foundry project (API key or Entra ID auth)
- 📋 List recent agent runs and sessions
- 🕒 Interactive timeline view of run steps — LLM calls, tool invocations, handoffs
- 🔍 Inspect inputs/outputs, latency, and token usage per step
- 📤 Export traces as JSON or Markdown reports

## Status / Roadmap

- [x] Phase 1 — Project scaffold, authentication, raw trace listing
- [ ] Phase 2 — Trace data normalization
- [ ] Phase 3 — Timeline visualization webview
- [ ] Phase 4 — Error handling, polish, docs
- [ ] Phase 5 — Marketplace publish

---

## Phase 1 — Setup & Configuration

### Prerequisites

- **Node.js** 18+ and **npm**
- **VS Code** 1.85+
- An **Azure AI Foundry** project with at least one agent created at [ai.azure.com](https://ai.azure.com)
- Either:
  - **Entra ID** auth: Azure CLI installed and logged in (`az login`), or any environment that supports `DefaultAzureCredential`
  - **API key** auth: an API key for your Foundry project

### Install & build

```bash
npm install
npm run compile
```

### Configure

Open VS Code Settings (`Cmd/Ctrl+Shift+P` → `Preferences: Open Settings (UI)`) and search for **AI Foundry Agent Inspector**.

| Setting | Description |
|---------|-------------|
| `aiFoundryAgentInspector.projectEndpoint` | Your Foundry project endpoint URL, e.g. `https://<hub>.services.ai.azure.com/api/projects/<project>` |
| `aiFoundryAgentInspector.authMethod` | `entraId` (default) or `apiKey` |
| `aiFoundryAgentInspector.maxRunsToList` | Max sessions/runs to fetch (default: 20) |

> **Finding your endpoint:** In the Foundry portal, go to your project → Overview → copy the "Project endpoint".

### Store your API key (if using API key auth)

1. Switch `authMethod` to `apiKey` in settings
2. Run the command `Foundry Trace: Set API Key` (`Cmd/Ctrl+Shift+P`)
3. Paste your key — it is stored securely in VS Code's built-in **SecretStorage** (never in `settings.json` or on disk)

To remove it later: `Foundry Trace: Clear API Key`

### Run in development

Press **F5** in VS Code to launch the Extension Development Host.

### Test the connection

1. `Cmd/Ctrl+Shift+P` → **Foundry Trace: Connect to Project**
2. Check the **Foundry Agent Trace** output channel for the list of agents — this confirms auth is working.

### List recent runs

1. `Cmd/Ctrl+Shift+P` → **Foundry Trace: List Recent Runs**
2. The **Foundry Agent Trace** output channel will show:
   - All **agents** defined in your project (raw JSON)
   - **Sessions** (runs) for each agent
   - **Connections** configured in your project

This raw JSON is the data you'll need for Phase 2 normalization.

---

## Commands

| Command | Description |
|---------|-------------|
| `Foundry Trace: Connect to Project` | Validates connection by listing agents |
| `Foundry Trace: List Recent Runs` | Dumps agents, sessions, and connections as raw JSON |
| `Foundry Trace: Set API Key` | Stores an API key in SecretStorage |
| `Foundry Trace: Clear API Key` | Removes the stored API key |

---

## Project structure

```
src/
  extension.ts          # Entry point — registers commands
  config.ts             # Settings access + SecretStorage helpers
  client.ts             # AIProjectClient factory
  outputChannel.ts      # Shared output channel singleton
  commands/
    connect.ts          # "Connect to Project" command
    listRuns.ts         # "List Recent Runs" command
    apiKey.ts           # Set/clear API key commands
```

---

## Packaging (later)

When ready for marketplace:

```bash
npm install -g @vscode/vsce
vsce package
```

This produces a `.vsix` you can install via `Extensions: Install from VSIX…`.

---

## SDK notes

This extension uses [`@azure/ai-projects`](https://www.npmjs.com/package/@azure/ai-projects) v2.x (the Foundry data-plane SDK) and [`@azure/identity`](https://www.npmjs.com/package/@azure/identity) for auth. Key APIs used:

- `client.agents.list()` — lists Foundry agents
- `client.beta.agents.listSessions(agentName)` — lists sessions (runs) per agent
- `client.connections.list()` — lists connected resources
- `client.getOpenAIClient()` — returns an OpenAI-compatible client for Responses API

## Requirements

- An [Azure AI Foundry](https://ai.azure.com) project with at least one Agent Service agent
- Node.js 18+ and VS Code 1.85+ for development

## License

[MIT](./LICENSE)

## Contributing

This project is in early development — issues and discussion are welcome, but expect things to move fast and change shape.
