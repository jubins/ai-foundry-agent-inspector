#!/usr/bin/env node
import {
  fetchResponsesTrace,
  fetchConversationTrace,
  type FoundryConfig,
  type AuthMethod,
  type Logger,
} from "foundry-trace-inspector-core";
import { parseArgs, flagString, flagBool } from "./args";
import { renderTrace } from "./render";

const HELP = `foundry-trace — inspect Microsoft Foundry agent traces from the terminal

Usage:
  foundry-trace show <resp_...> [<resp_...> ...]   Fetch and print one or more responses
  foundry-trace conversation <conv_...>            Fetch and print a full conversation

Options:
  --endpoint <url>     Foundry project endpoint (or FOUNDRY_PROJECT_ENDPOINT)
  --api-key <key>      Use API-key auth (or FOUNDRY_API_KEY). Omit to use Entra ID / az login.
  --json               Print the normalized trace as JSON instead of a readable tree
  --quiet              Suppress diagnostic logging
  -h, --help           Show this help

Auth:
  With --api-key (or FOUNDRY_API_KEY) the key is sent as the api-key header.
  Otherwise DefaultAzureCredential is used (az login, managed identity, env vars).

Examples:
  foundry-trace show resp_abc123 --endpoint https://my-hub.services.ai.azure.com/api/projects/my-proj
  FOUNDRY_PROJECT_ENDPOINT=... foundry-trace conversation conv_xyz --json
`;

function resolveEndpoint(flags: Record<string, string | boolean>): string {
  const endpoint =
    flagString(flags, "endpoint") ??
    process.env.FOUNDRY_PROJECT_ENDPOINT ??
    "";
  if (!endpoint.trim()) {
    fail(
      "No Foundry project endpoint. Pass --endpoint <url> or set FOUNDRY_PROJECT_ENDPOINT."
    );
  }
  return endpoint.trim();
}

function resolveAuth(flags: Record<string, string | boolean>): {
  authMethod: AuthMethod;
  apiKey?: string;
} {
  const apiKey = flagString(flags, "api-key") ?? process.env.FOUNDRY_API_KEY;
  if (apiKey) {
    return { authMethod: "apiKey", apiKey };
  }
  return { authMethod: "entraId" };
}

function buildConfig(flags: Record<string, string | boolean>): {
  config: FoundryConfig;
  apiKey?: string;
} {
  const endpoint = resolveEndpoint(flags);
  const { authMethod, apiKey } = resolveAuth(flags);
  const config: FoundryConfig = {
    projectEndpoint: endpoint,
    authMethod,
    maxRunsToList: 20,
    responseIds: [],
    conversationIds: [],
  };
  return { config, apiKey };
}

function fail(message: string): never {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  const { command, positionals, flags } = parseArgs(process.argv.slice(2));

  if (flagBool(flags, "help") || flags["h"] === true || !command) {
    process.stdout.write(HELP);
    process.exit(command ? 0 : 1);
  }

  const asJson = flagBool(flags, "json");
  const logger: Logger = flagBool(flags, "quiet")
    ? { appendLine() { /* quiet */ } }
    : { appendLine: (m) => process.stderr.write(m + "\n") };

  const { config, apiKey } = buildConfig(flags);

  switch (command) {
    case "show": {
      if (positionals.length === 0) {
        fail("`show` needs at least one response ID (resp_...).");
      }
      const agents = await fetchResponsesTrace(config, positionals, { apiKey, logger });
      output(agents, asJson);
      break;
    }
    case "conversation":
    case "conv": {
      const convId = positionals[0];
      if (!convId) {
        fail("`conversation` needs a conversation ID (conv_...).");
      }
      const agents = await fetchConversationTrace(config, convId, { apiKey, logger });
      output(agents, asJson);
      break;
    }
    default:
      fail(`Unknown command "${command}". Run with --help for usage.`);
  }
}

function output(agents: unknown, asJson: boolean): void {
  if (asJson) {
    process.stdout.write(JSON.stringify(agents, null, 2) + "\n");
  } else {
    process.stdout.write(renderTrace(agents as never) + "\n");
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  fail(message);
});
