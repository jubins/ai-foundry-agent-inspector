import type OpenAI from "openai";
import { createClient } from "./client";
import { buildOpenAIClient } from "./openaiClient";
import {
  normalizeFromResponses,
  normalizeFromConversationItems,
  type ResponseMeta,
} from "./trace/normalizer";
import type { TraceAgent } from "./trace/model";
import type { FoundryConfig } from "./config";
import { noopLogger, type Logger } from "./logger";

export interface FetchOptions {
  /** Required for API-key auth; ignored for Entra ID. */
  apiKey?: string;
  /** Optional sink for diagnostic messages. */
  logger?: Logger;
}

/**
 * Open an OpenAI-compatible client against a Foundry project using the given
 * config. Callers that need direct access to responses/conversations APIs can
 * use this; most should prefer {@link fetchResponsesTrace} /
 * {@link fetchConversationTrace}.
 */
export function openFoundryOpenAI(
  config: FoundryConfig,
  apiKey?: string
): OpenAI {
  const client = createClient(config, apiKey);
  return buildOpenAIClient(config.projectEndpoint, apiKey, client);
}

/**
 * Fetch one or more responses by ID and normalize them into trace agents.
 * Responses that cannot be fetched are logged and skipped.
 */
export async function fetchResponsesTrace(
  config: FoundryConfig,
  responseIds: string[],
  options: FetchOptions = {}
): Promise<TraceAgent[]> {
  const logger = options.logger ?? noopLogger;
  const openai = openFoundryOpenAI(config, options.apiKey);

  const responses: OpenAI.Responses.Response[] = [];
  for (const id of responseIds) {
    try {
      const resp = await openai.responses.retrieve(id);
      responses.push(resp);
      logger.appendLine(
        `Fetched response ${id}: status=${resp.status}, output items=${resp.output?.length ?? 0}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.appendLine(`Could not fetch response ${id}: ${msg}`);
    }
  }

  if (responses.length === 0) {
    throw new Error(
      "No responses could be fetched. Check the response IDs and try again."
    );
  }

  return normalizeFromResponses(responses);
}

/**
 * Fetch all items in a conversation, hydrate per-response metadata (model,
 * tokens, timing), and normalize into trace agents.
 */
export async function fetchConversationTrace(
  config: FoundryConfig,
  conversationId: string,
  options: FetchOptions = {}
): Promise<TraceAgent[]> {
  const logger = options.logger ?? noopLogger;
  const openai = openFoundryOpenAI(config, options.apiKey);

  const items: OpenAI.Conversations.ConversationItem[] = [];
  for await (const item of await openai.conversations.items.list(conversationId, { order: "asc" })) {
    items.push(item);
  }
  logger.appendLine(`Conversation ${conversationId}: ${items.length} items`);

  // Collect unique response IDs from assistant messages to hydrate metadata
  const responseIds = new Set<string>();
  for (const item of items) {
    const raw = item as unknown as { created_by?: { response_id?: string } };
    if (raw.created_by?.response_id) { responseIds.add(raw.created_by.response_id); }
  }

  // Fetch response metadata in parallel (model, tokens, timing)
  const responseMetas = new Map<string, ResponseMeta>();
  await Promise.all([...responseIds].map(async (rid) => {
    try {
      const resp = await openai.responses.retrieve(rid);
      responseMetas.set(rid, {
        id: rid,
        model: resp.model,
        status: resp.status ?? undefined,
        createdAt: resp.created_at,
        tokenUsage: resp.usage ? {
          input: resp.usage.input_tokens,
          output: resp.usage.output_tokens,
          total: resp.usage.input_tokens + resp.usage.output_tokens,
        } : undefined,
      });
    } catch { /* metadata fetch is best-effort */ }
  }));

  return normalizeFromConversationItems(conversationId, items, responseMetas);
}
