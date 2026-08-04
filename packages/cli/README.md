# foundry-trace-inspector-cli

Command-line tool to fetch and inspect [Microsoft Foundry](https://ai.azure.com)
agent traces straight from your terminal — no VS Code required. Built on
[`foundry-trace-inspector-core`](https://www.npmjs.com/package/foundry-trace-inspector-core).

Works for any model hosted on Foundry (GPT, Claude, Grok, Kimi, and others).

## Usage

Run without installing:

```bash
npx foundry-trace-inspector-cli show resp_abc123 \
  --endpoint https://my-hub.services.ai.azure.com/api/projects/my-project
```

Or install globally to get the `foundry-trace` command:

```bash
npm install -g foundry-trace-inspector-cli
foundry-trace show resp_abc123 --endpoint <url>
```

## Commands

```
foundry-trace show <resp_...> [<resp_...> ...]   Fetch and print one or more responses
foundry-trace conversation <conv_...>            Fetch and print a full conversation
```

## Options

| Flag | Description |
| --- | --- |
| `--endpoint <url>` | Foundry project endpoint (or `FOUNDRY_PROJECT_ENDPOINT`) |
| `--api-key <key>` | Use API-key auth (or `FOUNDRY_API_KEY`). Omit to use Entra ID / `az login`. |
| `--json` | Print the normalized trace as JSON instead of a readable tree |
| `--quiet` | Suppress diagnostic logging |
| `-h`, `--help` | Show help |

## Authentication

- With `--api-key` (or `FOUNDRY_API_KEY`) the key is sent as the `api-key` header.
- Otherwise `DefaultAzureCredential` is used: `az login`, managed identity,
  environment variables, and the rest of the Azure credential chain.

## Examples

```bash
# One response, readable output, via az login
foundry-trace show resp_abc123 --endpoint https://my-hub.services.ai.azure.com/api/projects/my-project

# A whole conversation as JSON, using env vars
export FOUNDRY_PROJECT_ENDPOINT=https://my-hub.services.ai.azure.com/api/projects/my-project
export FOUNDRY_API_KEY=...
foundry-trace conversation conv_xyz --json
```

Find response IDs (`resp_...`) and conversation IDs (`conv_...`) in the Foundry
portal under **Agents → your agent → Traces**.

## License

MIT
