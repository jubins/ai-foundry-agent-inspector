# Foundry Trace Inspector

[![Build](https://github.com/jubins/ai-foundry-agent-inspector/actions/workflows/ci.yml/badge.svg)](https://github.com/jubins/ai-foundry-agent-inspector/actions/workflows/ci.yml)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/0ff719144efc4b799a428ee5d785b11f)](https://app.codacy.com/gh/jubins/ai-foundry-agent-inspector/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

Inspect Azure AI Foundry agent traces without leaving VS Code. See exactly what your agent did — which tools it called, what it sent and received, token counts, cost, and timing — all in an interactive timeline panel.

> Free and open source. No account, no subscription, no telemetry.

![Foundry Trace Inspector demo](https://pub-72ba0f5d1e084c06abd6df442452f0cf.r2.dev/hero-video.gif)

---

## Features

- **Trajectories view** — collapsible span tree with Gantt-style timing bars, token counts, and cost per span
- **User View** — readable chat-bubble replay of the full conversation with agent name on each turn
- **Token & Cost chart** — input vs output tokens per LLM turn so you can spot expensive calls at a glance
- **Sidebar panel** — track conversations and responses from the Activity Bar; click any item to open its trace
- **"View Trace" deep link** — jump from any assistant bubble in User View directly to that response in the sidebar
- **Conversation tracking** — `conv_...` IDs are discovered automatically from saved responses
- **One-click refresh** — re-fetches all trace data without reopening the panel
- **API key or Entra ID auth** — API key stored in VS Code SecretStorage; or `az login` / managed identity
- **VS Code for the Web** — works on [vscode.dev](https://vscode.dev) with API key auth
- **Theme aware** — light, dark, and high-contrast all supported

---

## Getting Started

### 1. Install

Search **"Foundry Trace Inspector"** in the VS Code Extensions panel, or install from the [Marketplace](https://marketplace.visualstudio.com/items?itemName=jubinsoni.foundry-trace-inspector).

### 2. Configure

Click the **Foundry Trace Inspector** icon in the Activity Bar, then click the **⚙ gear** button to open the setup panel.

| Setting | Where to find it |
|---|---|
| **Project Endpoint** | Foundry portal → your project → Overview → *Project endpoint* |
| **Auth Method** | `apiKey` (recommended) or `entraId` (`az login` / managed identity) |

If using an API key, paste it in the setup panel — it is stored in VS Code's encrypted SecretStorage and never written to `settings.json`.

![Auth setup walkthrough](https://pub-72ba0f5d1e084c06abd6df442452f0cf.r2.dev/auth-setup.gif)

### 3. Track a conversation or response

**Option A — Track a conversation (recommended)**

1. In the Foundry portal, open your agent → **Traces** tab → copy the `conv_...` ID
2. In VS Code, click **+** next to **Conversations** in the sidebar and paste it

All responses in that conversation are discovered automatically.

**Option B — Track an individual response**

1. In the Foundry portal, open your agent → **Traces** tab → click a trace and copy the `resp_...` ID
2. In VS Code, click **+** next to **Responses** in the sidebar and paste it

![User conversation view](https://pub-72ba0f5d1e084c06abd6df442452f0cf.r2.dev/images/user-conversation-view.png)

### 4. Explore the trace

Click any response in the sidebar to open the trace panel. Switch between:

- **Trajectories** — span tree with timing bars
- **User View** — readable conversation replay with "View Trace" buttons
- **Duration / Tokens / Cost** — per-span breakdown charts

![Trajectories duration view](https://pub-72ba0f5d1e084c06abd6df442452f0cf.r2.dev/images/trajectories-duration.png)

---

## Screenshots

| Tokens | Cost |
|---|---|
| ![Tokens](https://pub-72ba0f5d1e084c06abd6df442452f0cf.r2.dev/images/trajectories-tokens.png) | ![Cost](https://pub-72ba0f5d1e084c06abd6df442452f0cf.r2.dev/images/trajectories-cost.png) |

![Token and cost breakdown](https://pub-72ba0f5d1e084c06abd6df442452f0cf.r2.dev/images/cost.png)

---

## Commands

All actions are available from the Activity Bar panel and the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P` → type **"Foundry Trace"**).

![Command palette](https://pub-72ba0f5d1e084c06abd6df442452f0cf.r2.dev/images/foundry-trace-commands.png)

| Command | Description |
|---|---|
| `Foundry Trace: Setup / Configure` | Open the setup panel |
| `Foundry Trace: Refresh` | Re-fetch all tracked data |
| `Foundry Trace: Add Response ID` | Track a `resp_...` response |
| `Foundry Trace: Add Conversation ID` | Track a `conv_...` conversation |
| `Foundry Trace: Delete Response` | Remove a tracked response |
| `Foundry Trace: Delete Conversation` | Remove a tracked conversation |
| `Foundry Trace: Set API Key` | Store an API key securely |
| `Foundry Trace: Clear API Key` | Remove the stored API key |

---

## Privacy

This extension makes API calls only to the Azure AI Foundry endpoint you configure. No usage data, telemetry, or trace content is sent anywhere else.

---

## Requirements

- VS Code 1.85 or later (desktop or [vscode.dev](https://vscode.dev))
- An Azure AI Foundry project with at least one agent
- An API key **or** Azure CLI (`az login`) / managed identity

---

## Contributing

Issues and pull requests are welcome at [github.com/jubins/ai-foundry-agent-inspector](https://github.com/jubins/ai-foundry-agent-inspector/issues).

---

## License

[MIT](./LICENSE) — free to use, modify, and distribute.
