# foundry-trace-inspector-core

Headless library for connecting to [Azure AI Foundry](https://ai.azure.com) and
normalizing agent traces into a clean, typed model. This is the engine behind the
[Foundry Trace Inspector](https://github.com/jubins/ai-foundry-agent-inspector)
VS Code extension and the `foundry-trace` CLI — extracted so you can build your
own tooling (dashboards, CI assertions, scripts) on top of it.

It works for any model hosted on Foundry (GPT, Claude, Grok, Kimi, and others).

## Install

```bash
npm install foundry-trace-inspector-core
```

## Quick start

```ts
import { fetchResponsesTrace } from "foundry-trace-inspector-core";

const config = {
  projectEndpoint: "https://my-hub.services.ai.azure.com/api/projects/my-project",
  authMethod: "apiKey",       // or "entraId"
  maxRunsToList: 20,
  responseIds: [],
  conversationIds: [],
};

const agents = await fetchResponsesTrace(config, ["resp_abc123"], {
  apiKey: process.env.FOUNDRY_API_KEY,
});

console.log(JSON.stringify(agents, null, 2));
```

## Authentication

- **API key** — set `authMethod: "apiKey"` and pass `apiKey`. The key is sent as
  the `api-key` header.
- **Entra ID** — set `authMethod: "entraId"`. Uses
  [`DefaultAzureCredential`](https://learn.microsoft.com/azure/developer/javascript/sdk/authentication/credential-chains)
  (`az login`, managed identity, environment variables, etc.). Requires a
  Node.js environment.

## API

| Export | Description |
| --- | --- |
| `fetchResponsesTrace(config, responseIds, opts?)` | Fetch responses by ID and normalize them into `TraceAgent[]`. |
| `fetchConversationTrace(config, conversationId, opts?)` | Fetch a full conversation (with per-response metadata) and normalize it. |
| `openFoundryOpenAI(config, apiKey?)` | Get a raw OpenAI-compatible client pointed at the project's `/openai/v1` surface. |
| `createClient(config, apiKey?)` | Build the underlying `AIProjectClient`. |
| `normalizeFromResponses(responses)` | Normalize already-fetched responses. |
| `normalizeFromConversationItems(id, items, metas?)` | Normalize already-fetched conversation items. |

Types: `FoundryConfig`, `AuthMethod`, `TraceAgent`, `TraceSession`, `TraceStep`,
`LlmStep`, `ToolCallStep`, `MessageStep`, `TokenUsage`, `Logger`.

`fetchResponsesTrace` / `fetchConversationTrace` accept an options object with an
optional `apiKey` (required for API-key auth) and a `logger` for diagnostics.

## License

MIT
