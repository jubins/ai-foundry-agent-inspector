# AI Foundry Agent Inspector

**Inspect Azure AI Foundry agent traces without leaving VS Code.**

See exactly what your agent did on every run — which tools it called, what it sent and received, and how many tokens each LLM turn cost — all in an interactive timeline panel.

![Timeline view showing LLM turns, tool calls, and token chart](images/screenshot-timeline.png)

---

## Why

The Foundry portal shows traces, but switching between your editor and a browser tab breaks your flow. This extension brings the same trace data into VS Code so you can debug agent behavior while you're looking at the code that produced it.

---

## Features

- **Interactive trace timeline** — collapsible LLM turns, tool calls with JSON input/output, user and assistant messages, all in one panel
- **Token usage chart** — stacked bar chart showing input vs output tokens per LLM turn, so you can spot expensive turns at a glance
- **Saved response IDs** — paste a `resp_...` ID once; the extension remembers it and pre-selects it every time after
- **API key or Entra ID auth** — works with an API key stored in VS Code SecretStorage, or `DefaultAzureCredential` (`az login`, managed identity)
- **One-click refresh** — re-fetch the latest trace without reopening the panel

---

## Getting started

### 1. Install prerequisites

- VS Code 1.85+
- An [Azure AI Foundry](https://ai.azure.com) project with at least one agent
- Node.js 18+ (for development only)

### 2. Configure the extension

Open Settings (`Cmd/Ctrl+,`) and search for **AI Foundry Agent Inspector**, or go to `Cmd/Ctrl+Shift+P` → **Preferences: Open Settings (UI)**.

| Setting | What to put here |
|---|---|
| `Project Endpoint` | Your Foundry project endpoint — found in the portal under your project → Overview |
| `Auth Method` | `apiKey` if you have an API key, `entraId` if you use `az login` |

![Settings panel showing projectEndpoint and authMethod fields](images/screenshot-settings.png)

> **Finding your endpoint:** In the Foundry portal, open your project → Overview → copy the value labelled "Project endpoint". It looks like `https://<hub>.services.ai.azure.com/api/projects/<project>`.

### 3. Store your API key (API key auth only)

1. Set `Auth Method` to `apiKey`
2. Run `Cmd/Ctrl+Shift+P` → **Foundry Trace: Set API Key**
3. Paste your key — it is stored in VS Code's built-in **SecretStorage**, never written to disk or `settings.json`

### 4. Show a trace

1. In the Foundry portal, open your agent → **Traces** tab → click any trace → copy the `resp_...` response ID from the URL or detail panel

![Foundry portal Traces tab with response ID highlighted](images/screenshot-portal-traces.png)

2. In VS Code: `Cmd/Ctrl+Shift+P` → **Foundry Trace: Show Trace**
3. First time: pick **Add new response ID…** and paste the ID. It saves automatically.
4. Every time after: your saved IDs are pre-selected — just press **Enter**

![QuickPick showing saved response IDs pre-selected](images/screenshot-quickpick.png)

The trace panel opens and shows the full conversation:

![Trace panel showing a completed session with token chart and expanded tool call](images/screenshot-trace-detail.png)

---

## The trace panel

![Annotated trace panel](images/screenshot-annotated.png)

| Element | What it shows |
|---|---|
| 🧠 **LLM Turn** | One call to the model — expand to see any tool calls made |
| 🔧 **Tool Call** | A function the agent invoked — expand to see the JSON input and output |
| 👤 **User** | The message that triggered this response |
| 🤖 **Assistant** | The agent's reply |
| **Token chart** | Stacked bar: blue = input tokens, teal = output tokens, one bar per LLM turn |
| **Refresh** | Re-fetches all saved response IDs and updates the panel |

---

## Commands

| Command | Description |
|---|---|
| `Foundry Trace: Show Trace` | Open the trace timeline for saved response IDs |
| `Foundry Trace: Connect to Project` | Validate connection — lists your agents in the output channel |
| `Foundry Trace: List Recent Runs` | Dump agents and sessions as raw JSON (useful for debugging) |
| `Foundry Trace: Set API Key` | Store an API key securely in SecretStorage |
| `Foundry Trace: Clear API Key` | Remove the stored API key |

---

## How response IDs work

Azure AI Foundry uses OpenAI's Responses API internally. Each agent reply creates a `resp_...` response ID, visible in the portal Traces tab. This extension fetches those responses directly via the same API.

When a conversation spans multiple turns, each response links to the previous one via `previous_response_id`. Load any response in a chain and the extension reconstructs the full session automatically.

There is no public API to list response IDs — you copy them from the portal once, and the extension remembers them from there.

---

## Requirements

- VS Code 1.85+
- An Azure AI Foundry project with at least one agent
- API key **or** Azure CLI (`az login`) for authentication

## License

[MIT](./LICENSE)

## Contributing

Issues and discussion welcome at [github.com/jubins/ai-foundry-agent-inspector](https://github.com/jubins/ai-foundry-agent-inspector/issues).
