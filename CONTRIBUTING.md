# Contributing to Foundry Trace Inspector

Thank you for your interest in contributing!

---

## 🐛 Did you find a bug?

- Ensure the bug was not already reported by searching [GitHub Issues](https://github.com/jubins/ai-foundry-agent-inspector/issues).
- If you can't find an open issue addressing the problem, [open a new one](https://github.com/jubins/ai-foundry-agent-inspector/issues/new). Include a clear title, description, steps to reproduce, and what you expected to happen.

## 🔧 Did you write a patch that fixes a bug?

- Open a new GitHub pull request with the patch.
- Clearly describe the problem and solution in the PR description. Include the relevant issue number if applicable.
- Before submitting, please read the [Code of Conduct](./CODE_OF_CONDUCT.md).

## 💡 Do you intend to add a new feature or change an existing one?

- [Open a discussion](https://github.com/jubins/ai-foundry-agent-inspector/discussions) under the **Ideas** category first to gather feedback before writing code.
- Once you have positive feedback, fork the repo, implement the change, and open a PR.
- Reference the discussion number in your PR — PRs for non-trivial features without a linked discussion may be closed without review.

## ❓ Do you have questions about the source code?

Ask in the [Discussions tab](https://github.com/jubins/ai-foundry-agent-inspector/discussions).

---

## 🏗️ Guidelines

### Project structure

```
src/
├── extension.ts              # Entry point — registers all commands and the sidebar
├── client.ts                 # Creates AIProjectClient (desktop, uses @azure/identity)
├── client.web.ts             # Creates AIProjectClient (web, API key only)
├── config.ts                 # Reads VS Code settings and SecretStorage
├── outputChannel.ts          # Shared output channel
├── commands/
│   ├── apiKey.ts             # Set / clear API key commands
│   ├── connect.ts            # Legacy connect command
│   ├── listRuns.ts           # Legacy list runs command
│   └── showTrace.ts          # Fetches responses/conversations and opens the trace panel
├── sidebar/
│   ├── connectionState.ts    # In-memory connection state + event emitter
│   ├── foundryTreeProvider.ts # Activity Bar tree (conversations + responses)
│   └── onboardingPanel.ts    # Setup / configure webview panel
├── trace/
│   ├── model.ts              # Shared trace data model types
│   └── normalizer.ts         # Converts raw API responses into TraceAgent[]
└── webview/
    └── tracePanel.ts         # Trajectories / User View / chart webview panel
scripts/
├── bundle-web.js             # esbuild browser bundle (with web-specific plugins)
├── patch-bundle.js           # Patches import.meta.url in the desktop CJS bundle
└── web-globals-shim.js       # DOM stubs for packages that check globals at load time
```

### Adding a new command

1. Register it in `package.json` under `contributes > commands` (and add a `menus` entry if it needs a toolbar button or context menu item).
2. Register the command handler in `src/extension.ts` inside `activate()`.
3. Implement the logic in `src/commands/` or inline in `extension.ts` for small handlers.

### Adding a new view or panel

- **Sidebar tree items** — extend `FoundryTreeItem` in `src/sidebar/foundryTreeProvider.ts` and add the new `ItemKind` variant.
- **Webview panels** — follow the pattern in `src/webview/tracePanel.ts` or `src/sidebar/onboardingPanel.ts`. Use `enableScripts: true` and communicate via `postMessage` / `onDidReceiveMessage`.

### Adding a new trace view tab

The trace panel (`src/webview/tracePanel.ts`) renders tabs in JavaScript inside the webview. Add a new tab button and a corresponding render function alongside the existing Trajectories / User View / chart tabs.

### Working with the data model

Raw API data flows like this:

```
OpenAI Responses API / Conversations API
        ↓
src/trace/normalizer.ts   (normalizeFromResponses / normalizeFromConversationItems)
        ↓
TraceAgent[]              (src/trace/model.ts)
        ↓
src/webview/tracePanel.ts (rendered in the webview)
```

If the Foundry API adds new fields, update the normalizer and model first, then the webview rendering.

### Desktop vs web bundles

The extension ships two bundles:

| Bundle | Entry | Platform | Auth |
|---|---|---|---|
| `out/extension.js` | `src/extension.ts` + `src/client.ts` | Node (desktop) | API key or Entra ID |
| `out/extension.web.js` | `src/extension.ts` + `src/client.web.ts` | Browser (web) | API key only |

The web bundle uses an esbuild plugin in `scripts/bundle-web.js` to redirect `./client` imports to `client.web.ts`. If you add a new file that imports from `./client` or `../client`, it will be redirected automatically — no changes to the build script needed.

### Running locally

```bash
npm install
npm run compile       # TypeScript type-check
npm run bundle        # Build desktop bundle
npm run bundle:web    # Build web bundle
npm run lint          # ESLint
```

Press `F5` in VS Code to launch an Extension Development Host with the extension loaded.
