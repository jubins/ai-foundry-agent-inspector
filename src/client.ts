import { AIProjectClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";
import type { TokenCredential, AccessToken, GetTokenOptions } from "@azure/core-auth";
import type { FoundryConfig } from "./config";

// Placeholder credential used when API key auth is selected.
// The real key is injected via an additionalPolicy pipeline step below,
// so this credential just needs to satisfy the TokenCredential interface
// without causing the SDK to reject it during construction.
class NoOpCredential implements TokenCredential {
  getToken(_scopes: string | string[], _options?: GetTokenOptions): Promise<AccessToken> {
    // Return a dummy token so the SDK's bearer-token pipeline policy doesn't
    // crash. Our additionalPolicy runs perCall and overwrites the Authorization
    // header with the real api-key header before the request goes out.
    return Promise.resolve({ token: "placeholder", expiresOnTimestamp: Date.now() + 3600_000 });
  }
}

export function createClient(
  config: FoundryConfig,
  apiKey?: string
): AIProjectClient {
  if (config.authMethod === "apiKey") {
    if (!apiKey) {
      throw new Error(
        'Auth method is "apiKey" but no API key is stored. Run "Foundry Trace: Set API Key" first.'
      );
    }

    // Inject the API key as an `api-key` header via a pipeline policy.
    // This is how Azure AI services accept API key auth alongside Entra ID.
    const keyToCapture = apiKey;
    return new AIProjectClient(config.projectEndpoint, new NoOpCredential(), {
      additionalPolicies: [
        {
          policy: {
            name: "foundryApiKeyPolicy",
            sendRequest(request, next) {
              request.headers.set("api-key", keyToCapture);
              // Remove any Authorization header the NoOpCredential may have set
              request.headers.delete("Authorization");
              return next(request);
            },
          },
          position: "perCall",
        },
      ],
    });
  }

  // Entra ID / DefaultAzureCredential: az login, managed identity, env vars, etc.
  return new AIProjectClient(config.projectEndpoint, new DefaultAzureCredential());
}
