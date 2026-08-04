// Node build: delegate to the shared core implementation (which uses
// DefaultAzureCredential). The web build swaps this module for client.web.ts
// via the esbuild alias in scripts/bundle-web.js, since @azure/identity cannot
// run in the VS Code Web extension host.
export { createClient } from "foundry-trace-inspector-core";
