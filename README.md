# AI Foundry Agent Inspector

A VS Code extension for visualizing and debugging **Azure AI Foundry Agent Service** runs directly in your editor — no portal hopping, no throwaway scripts.

> ⚠️ **Status: Early development.** This project is under active development and not yet published to the VS Code Marketplace. Expect breaking changes.

## Why

Debugging agent behavior in Azure AI Foundry (tool calls, multi-step reasoning, handoffs, token usage) currently means digging through the Foundry portal or writing one-off scripts to inspect run traces. **AI Foundry Agent Inspector** brings that trace data into VS Code as an interactive timeline, so you can see exactly what your agent did, step by step, while you're in your code.

## Planned Features

- 🔌 Connect to your Azure AI Foundry project (API key or Entra ID auth)
- 📋 List recent agent runs and threads
- 🕒 Interactive timeline view of run steps — LLM calls, tool invocations, handoffs
- 🔍 Inspect inputs/outputs, latency, and token usage per step
- 📤 Export traces as JSON or Markdown reports

## Status / Roadmap

- [ ] Phase 1 — Project scaffold, authentication, raw trace listing
- [ ] Phase 2 — Trace data normalization
- [ ] Phase 3 — Timeline visualization webview
- [ ] Phase 4 — Error handling, polish, docs
- [ ] Phase 5 — Marketplace publish

## Requirements

- An [Azure AI Foundry](https://ai.azure.com) project with at least one Agent Service agent
- Node.js and VS Code for development

## Setup (development)

```bash
npm install
npm run compile
```

Press `F5` in VS Code to launch the Extension Development Host.

Configure your Foundry project connection via VS Code settings (`AI Foundry Agent Inspector`):

- `aiFoundryAgentInspector.projectEndpoint` — your Foundry project endpoint URL
- Authentication is handled via Entra ID (`DefaultAzureCredential`) or an API key stored securely in VS Code SecretStorage

## License

[MIT](./LICENSE)

## Contributing

This project is in early development — issues and discussion are welcome, but expect things to move fast and change shape.
