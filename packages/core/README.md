<div align="center">

<img src="https://raw.githubusercontent.com/jubins/ai-foundry-agent-inspector/master/images/icon.png" alt="Foundry Trace Inspector" width="96" height="96" />

# foundry-trace-inspector-core

[![npm](https://img.shields.io/npm/v/foundry-trace-inspector-core.svg)](https://www.npmjs.com/package/foundry-trace-inspector-core)
[![CI](https://github.com/jubins/ai-foundry-agent-inspector/actions/workflows/ci.yml/badge.svg)](https://github.com/jubins/ai-foundry-agent-inspector/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/jubins/ai-foundry-agent-inspector/blob/master/LICENSE)

**Connect to Microsoft Foundry and normalize agent traces into a clean, typed model.**

</div>

A headless library for fetching Microsoft Foundry agent traces and normalizing
them into a clean, typed model you can build on — dashboards, CI assertions,
scripts, or any tooling of your own. Just the Foundry client and the trace
normalizer, no UI.

Works for any model hosted on Foundry (GPT, Claude, Grok, Kimi, and others).

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

[MIT](https://github.com/jubins/ai-foundry-agent-inspector/blob/master/LICENSE) © Jubin Soni
