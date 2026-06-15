# Foundry Trace Inspector

Inspect Azure AI Foundry agent traces without leaving VS Code. **Free, open source.**

See exactly what your agent did on every run — which tools it called, what it sent and received, how many tokens each LLM turn cost, and the duration and dollar cost — all in an interactive timeline panel. Track multiple conversations and responses from the Activity Bar.

> No account, no subscription, no telemetry.

![Foundry Trace Inspector demo](https://pub-72ba0f5d1e084c06abd6df442452f0cf.r2.dev/hero-video.gif)

---

## What it does

**Foundry Trace Inspector** connects to your Azure AI Foundry project and gives you three views for every agent run:

### Trajectories
A Gantt-style span tree — Session → Invoke Agent → Chat + Tool calls — with per-span duration, token counts, and cost. Click any span to expand its detail drawer showing model, status, token breakdown, and raw input/output.

### User View
A chat-bubble replay of the conversation: user messages and assistant replies rendered as a readable timeline, with the agent name, model, and a "View Trace" button on each assistant turn that jumps you directly to the corresponding response in the sidebar.

### Token & Cost chart
A stacked bar chart (input vs output tokens per LLM turn) so you can spot the expensive turns at a glance.

| Duration | Tokens | Cost |
|----------|--------|------|
| ![Trajectories duration view](https://pub-72ba0f5d1e084c06abd6df442452f0cf.r2.dev/images/trajectories-duration.png) | ![Trajectories tokens view](https://pub-72ba0f5d1e084c06abd6df442452f0cf.r2.dev/images/trajectories-tokens.png) | ![Trajectories cost view](https://pub-72ba0f5d1e084c06abd6df442452f0cf.r2.dev/images/trajectories-cost.png) |

---

## Features

- **Sidebar panel** — tracked conversations and responses live in the Activity Bar; click any response to open its trace; click any conversation to filter its responses
- **Trajectories view** — collapsible span tree with Gantt bars, duration, tokens, and cost per span
- **User View** — readable chat-bubble replay of the full conversation with agent name on each turn
- **Token chart** — input vs output tokens per LLM turn, one bar per call
- **"View Trace" deep link** — click from any assistant bubble in User View to jump to that exact response in the sidebar (highlighted automatically)
- **Saved response IDs** — paste a `resp_...` ID once; it's remembered and auto-selected next time
- **Conversation tracking** — `conv_...` IDs are discovered automatically from your saved responses; filter the sidebar by conversation
- **One-click refresh** — re-fetches all data without reopening the panel
- **API key or Entra ID auth** — API key stored in VS Code SecretStorage, or `DefaultAzureCredential` (`az login`, managed identity)
- **Respects your VS Code theme** — light, dark, and high-contrast all work

---

## Getting started

### 1. Install

Search **"Foundry Trace Inspector"** in the VS Code Extensions panel, or install from the [Marketplace page](https://marketplace.visualstudio.com/items?itemName=jubinsoni.foundry-trace-inspector).

### 2. Configure

Click the **Foundry Trace Inspector** icon in the Activity Bar (left sidebar), then click the **⚙ gear** button to open the setup panel.

You need two things:

| Setting | Where to find it |
|---|---|
| **Project Endpoint** | Foundry portal → your project → Overview → "Project endpoint" |
| **Auth Method** | `apiKey` (paste a key) or `entraId` (`az login` / managed identity) |

If using an API key, click **Set API Key** in the setup panel — your key is stored in VS Code's encrypted SecretStorage and never written to `settings.json`.

> **Your data stays on your machine.** API keys, project endpoints, and trace content are never sent to any server outside your own Azure endpoint. Nothing is stored or logged by this extension beyond what VS Code itself persists locally.

![Auth setup walkthrough](https://pub-72ba0f5d1e084c06abd6df442452f0cf.r2.dev/auth-setup.gif)

### 3. Add a response ID

1. In the Foundry portal, open your agent → **Traces** tab → click a trace
2. Copy the `resp_...` ID from the URL or detail pane
3. In VS Code, click **+** next to **Responses** in the sidebar and paste the ID

The extension fetches the trace and displays it immediately.

![User conversation view](https://pub-72ba0f5d1e084c06abd6df442452f0cf.r2.dev/images/user-conversation-view.png)

### 4. Explore the trace

Click any response in the sidebar to open the trace panel. Switch between:

- **Trajectories** — span tree with timing bars
- **User View** — readable conversation with "View Trace" buttons
- **Duration / Tokens / Cost** — per-span breakdown

![Token and cost breakdown](https://pub-72ba0f5d1e084c06abd6df442452f0cf.r2.dev/images/cost.png)

---


## Commands

Everything can be done from the **Foundry Trace Inspector panel** in the Activity Bar — but all actions are also available via the Command Palette. Press `Cmd+Shift+P` (Mac) / `Ctrl+Shift+P` (Windows/Linux) and type **"Foundry Trace"** to see all commands.

![Foundry Trace commands in the Command Palette](https://pub-72ba0f5d1e084c06abd6df442452f0cf.r2.dev/images/foundry-trace-commands.png)

| Command | Panel equivalent |
|---|---|
| `Foundry Trace: Setup / Configure` | ⚙ gear button in the panel header |
| `Foundry Trace: Refresh` | ↺ refresh button in the panel header |
| `Foundry Trace: Add Response ID` | **+** next to Responses in the sidebar |
| `Foundry Trace: Add Conversation ID` | **+** next to Conversations in the sidebar |
| `Foundry Trace: Delete Response` | 🗑 trash icon on a response item |
| `Foundry Trace: Delete Conversation` | 🗑 trash icon on a conversation item |
| `Foundry Trace: Open Response` | Click any response in the sidebar |
| `Foundry Trace: Set API Key` | "Set API Key" button in the setup panel |
| `Foundry Trace: Clear API Key` | "Clear API Key" button in the setup panel |

---

## How it works

Azure AI Foundry agents use the OpenAI Responses API internally. Every agent reply creates a `resp_...` response ID visible in the Foundry portal Traces tab. This extension fetches those responses directly via the same API and reconstructs the full conversation timeline locally — no intermediate server, no data leaves your machine except the API calls to your own Foundry endpoint.

When a session spans multiple turns, each response links to the previous one via `previous_response_id`. Load any response in the chain and the extension walks the chain automatically.

Conversation IDs (`conv_...`) are discovered automatically from your saved responses — you don't need to add them manually unless you want to track a conversation before you have any of its response IDs.

---

## Requirements

- VS Code 1.85 or later
- An Azure AI Foundry project with at least one agent
- An API key **or** Azure CLI (`az login`) / managed identity for authentication

---

## Privacy

This extension makes API calls only to the Azure AI Foundry endpoint you configure. No usage data, telemetry, or trace content is sent anywhere else.

---

## License

[MIT](./LICENSE) — free to use, modify, and distribute.

## Contributing

Issues and pull requests welcome at [github.com/jubins/ai-foundry-agent-inspector](https://github.com/jubins/ai-foundry-agent-inspector/issues).
