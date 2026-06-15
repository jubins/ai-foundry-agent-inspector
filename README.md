# Foundry Trace Inspector

Inspect Azure AI Foundry agent traces without leaving VS Code. **Free, open source.**

See exactly what your agent did on every run — which tools it called, what it sent and received, how many tokens each LLM turn cost, and the duration and dollar cost — all in an interactive timeline panel. Track multiple conversations and responses from the Activity Bar.

> No account, no subscription, no telemetry.

<!--
  SCREENSHOT: Main trace panel open with Trajectories tab visible and spans expanded.
  Recommended: 1280×800 window, 2x Retina capture.
  Save to: images/screenshot-timeline.png
-->
<!-- ![Trace timeline showing Session → Invoke Agent → Chat and tool spans](images/screenshot-timeline.png) -->

---

## What it does

**AI Foundry Agent Inspector** connects to your Azure AI Foundry project and gives you three views for every agent run:

### Trajectories
A Gantt-style span tree — Session → Invoke Agent → Chat + Tool calls — with per-span duration, token counts, and cost. Click any span to expand its detail drawer showing model, status, token breakdown, and raw input/output.

### User View
A chat-bubble replay of the conversation: user messages and assistant replies rendered as a readable timeline, with the agent name, model, and a "View Trace" button on each assistant turn that jumps you directly to the corresponding response in the sidebar.

### Token & Cost chart
A stacked bar chart (input vs output tokens per LLM turn) so you can spot the expensive turns at a glance.

<!--
  SCREENSHOT: Trajectories tab with Session > Invoke Agent > Chat span tree expanded.
  Save to: images/screenshot-trajectories.png
-->
<!-- ![Trajectories tab showing span tree with duration bars](images/screenshot-trajectories.png) -->

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

Search **"AI Foundry Agent Inspector"** in the VS Code Extensions panel, or install from the [Marketplace page](https://marketplace.visualstudio.com/items?itemName=jubinsoni.ai-foundry-agent-inspector).

### 2. Configure

Click the **AI Foundry Inspector** icon in the Activity Bar (left sidebar), then click the **⚙ gear** button to open the setup panel.

You need two things:

| Setting | Where to find it |
|---|---|
| **Project Endpoint** | Foundry portal → your project → Overview → "Project endpoint" |
| **Auth Method** | `apiKey` (paste a key) or `entraId` (`az login` / managed identity) |

If using an API key, click **Set API Key** in the setup panel — your key is stored in VS Code's encrypted SecretStorage and never written to `settings.json`.

<!--
  SCREENSHOT: VS Code Settings UI showing the AI Foundry Agent Inspector section.
  Save to: images/screenshot-settings.png
-->
<!-- ![Settings panel showing projectEndpoint and authMethod fields](images/screenshot-settings.png) -->

### 3. Add a response ID

1. In the Foundry portal, open your agent → **Traces** tab → click a trace
2. Copy the `resp_...` ID from the URL or detail pane
3. In VS Code, click **+** next to **Responses** in the sidebar and paste the ID

The extension fetches the trace and displays it immediately.

<!--
  SCREENSHOT: The sidebar showing Conversations and Responses sections with real data.
  Save to: images/screenshot-sidebar.png
-->
<!-- ![Sidebar showing Conversations and Responses sections with real entries](images/screenshot-sidebar.png) -->

### 4. Explore the trace

Click any response in the sidebar to open the trace panel. Switch between:

- **Trajectories** — span tree with timing bars
- **User View** — readable conversation with "View Trace" buttons
- **Duration / Tokens / Cost** — per-span breakdown

<!--
  SCREENSHOT: Trace panel open on the User View tab, showing assistant bubbles with agent name.
  Save to: images/screenshot-trace-detail.png
-->
<!-- ![Trace panel showing User View with chat bubbles and agent name](images/screenshot-trace-detail.png) -->

---

## Screenshots to add

> The screenshots above are placeholders — actual images coming soon. In the meantime, here is what each view looks like:
>
> - **Trajectories**: A tree of colored span rows (purple Session → blue Invoke Agent → teal Chat → orange Tool), each with a proportional timing bar and token/cost stats on hover
> - **User View**: Chat bubbles showing user messages (right-aligned) and assistant replies (left-aligned) with the agent name and model shown above each assistant bubble
> - **Token chart**: Stacked horizontal bars, one per LLM turn, blue = input tokens, teal = output tokens

---

## Commands

| Command | Description |
|---|---|
| `AI Foundry: Setup / Configure` | Open the setup panel to enter your endpoint and API key |
| `AI Foundry: Refresh` | Re-fetch all tracked responses and update the sidebar |
| `AI Foundry: Add Response ID` | Paste a `resp_...` ID to track it |
| `AI Foundry: Add Conversation ID` | Paste a `conv_...` ID to track it |
| `AI Foundry: Open Response` | Open the trace panel for a specific response |
| `Foundry Trace: Set API Key` | Store an API key securely in SecretStorage |
| `Foundry Trace: Clear API Key` | Remove the stored API key |

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
