import { AIProjectClient } from "@azure/ai-projects";
import type { TokenCredential, AccessToken, GetTokenOptions } from "@azure/core-auth";
import type { FoundryConfig } from "./config";

class NoOpCredential implements TokenCredential {
  getToken(_scopes: string | string[], _options?: GetTokenOptions): Promise<AccessToken> {
    return Promise.resolve({ token: "placeholder", expiresOnTimestamp: Date.now() + 3600_000 });
  }
}

export function createClient(
  config: FoundryConfig,
  apiKey?: string
): AIProjectClient {
  if (config.authMethod === "entraId") {
    throw new Error(
      "Entra ID / az login authentication is not supported in VS Code for the Web. " +
      "Open the Foundry Trace Inspector setup panel and switch to API Key authentication."
    );
  }

  if (!apiKey) {
    throw new Error(
      'Auth method is "apiKey" but no API key is stored. Run "Foundry Trace: Setup / Configure" first.'
    );
  }

  const keyToCapture = apiKey;
  return new AIProjectClient(config.projectEndpoint, new NoOpCredential(), {
    additionalPolicies: [
      {
        policy: {
          name: "foundryApiKeyPolicy",
          sendRequest(request, next) {
            request.headers.set("api-key", keyToCapture);
            request.headers.delete("Authorization");
            return next(request);
          },
        },
        position: "perCall",
      },
    ],
  });
}
