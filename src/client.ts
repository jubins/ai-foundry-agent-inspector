import { AIProjectClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";
import type { TokenCredential, AccessToken, GetTokenOptions } from "@azure/core-auth";
import type { FoundryConfig } from "./config";

/**
 * Wraps a static API key as a TokenCredential by returning the key as the
 * token value. Azure AI Foundry's data-plane accepts `api-key: <value>` headers
 * in addition to Bearer tokens, and the underlying pipeline picks this up when
 * the "token" equals the raw API key.
 *
 * Note: This pattern is supported by @azure/core-rest-pipeline for services
 * that accept both AAD tokens and API keys via the same auth header.
 */
class ApiKeyAsTokenCredential implements TokenCredential {
  constructor(private readonly key: string) {}

  getToken(_scopes: string | string[], _options?: GetTokenOptions): Promise<AccessToken> {
    return Promise.resolve({ token: this.key, expiresOnTimestamp: Date.now() + 3600_000 });
  }
}

export function createClient(
  config: FoundryConfig,
  apiKey?: string
): AIProjectClient {
  let credential: TokenCredential;

  if (config.authMethod === "apiKey") {
    if (!apiKey) {
      throw new Error(
        'Auth method is "apiKey" but no API key is stored. Run "Foundry Trace: Set API Key" first.'
      );
    }
    credential = new ApiKeyAsTokenCredential(apiKey);
  } else {
    // Entra ID / DefaultAzureCredential covers: az login, managed identity, env vars, etc.
    credential = new DefaultAzureCredential();
  }

  return new AIProjectClient(config.projectEndpoint, credential);
}
