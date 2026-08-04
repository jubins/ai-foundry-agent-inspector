import OpenAI from "openai";
import type { AIProjectClient } from "@azure/ai-projects";

/**
 * Build an OpenAI-compatible client that talks to a Foundry project's
 * `/openai/v1` surface.
 *
 * With an API key we construct the client directly against the endpoint; with
 * Entra ID we defer to the already-authenticated `AIProjectClient` so its
 * credential pipeline is reused.
 */
export function buildOpenAIClient(
  endpoint: string,
  apiKey: string | undefined,
  client: AIProjectClient
): OpenAI {
  const baseURL = `${endpoint.replace(/\/$/, "")}/openai/v1`;
  if (apiKey) {
    return new OpenAI({
      apiKey,
      baseURL,
      defaultHeaders: { "api-key": apiKey },
      dangerouslyAllowBrowser: true,
    });
  }
  return client.getOpenAIClient();
}
