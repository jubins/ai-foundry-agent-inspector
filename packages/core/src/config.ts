export type AuthMethod = "entraId" | "apiKey";

/**
 * Everything needed to connect to a Foundry project and fetch traces.
 * This is a plain data shape with no dependency on any host environment
 * (VS Code, CLI, etc.) — hosts are responsible for building it however they
 * like (settings, flags, env vars).
 */
export interface FoundryConfig {
  projectEndpoint: string;
  authMethod: AuthMethod;
  /** Max number of recent runs to fetch when listing. */
  maxRunsToList: number;
  responseIds: string[];
  conversationIds: string[];
}
