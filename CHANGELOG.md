# Changelog

All notable changes to **Foundry Trace Inspector** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **`foundry-trace-inspector-core`** npm package — a headless library exposing the Foundry client, OpenAI client builder, trace normalizer, and typed trace model, so traces can be fetched and normalized from any Node.js code
- **`foundry-trace-inspector-cli`** npm package — a `foundry-trace` command that fetches responses and conversations and prints them as a readable tree or JSON, with API key or Entra ID auth via flags or environment variables
- npm and Marketplace version badges in the README

### Changed
- Repository restructured into npm workspaces; the extension now consumes the shared `foundry-trace-inspector-core` package instead of its own copies of the client and normalizer
- Renamed "Azure AI Foundry" to "Microsoft Foundry" throughout the docs, UI, and package metadata
- Release workflow now bumps the extension and both npm packages in lockstep and publishes to the VS Code Marketplace, npm, and GitHub Releases in a single run

---

## [0.1.5] - 2026-06-23

### Added
- Manual publish workflow for the VS Code Marketplace (`workflow_dispatch` with a patch/minor/major version bump)
- Dependabot configuration for dependency updates

### Fixed
- Errors in the publish workflow that prevented Marketplace releases

---

## [0.1.4] - 2026-06-23

### Added
- VS Code for the Web support — extension now installable and functional on [vscode.dev](https://vscode.dev)
- Browser entry point (`out/extension.web.js`) with a web-specific client that supports API key auth only
- Clear error message in the setup panel when Entra ID auth is selected on VS Code Web
- GitHub Actions CI workflow — lint, desktop bundle, web bundle, and `.vsix` package check on every PR and push to `master`
- `CONTRIBUTING.md` with project structure guide and contribution guidelines
- `CODE_OF_CONDUCT.md`

### Fixed
- Extension activation crash on VS Code Web caused by `@azure/core-xml` accessing DOM globals (`document.implementation.createDocument`) at module load time in the web worker environment

---

## [0.1.3] - 2026-06-10

### Fixed
- Extension activation crash caused by `import.meta.url` being `undefined` in the bundled CJS output — switched to esbuild bundling with a post-bundle patch script

### Changed
- Replaced `tsc` compilation with esbuild for smaller, faster bundles
- Removed `node_modules` from the packaged `.vsix`

---

## [0.1.2] - 2026-06-05

### Added
- Conversation tracking — `conv_...` IDs are now discovered automatically from saved responses
- Conversation selection in the sidebar filters the Responses section
- Delete conversation and delete response commands with trash icon in the sidebar
- Disconnect / Reset option in the setup panel
- "View Trace" deep link — click any assistant bubble in User View to jump directly to that response in the sidebar
- Silent refresh — sidebar updates without showing a connecting spinner

### Fixed
- Response hydration issue when fetching multiple saved response IDs
- Highlight not clearing correctly when switching between responses
- Agent name fallback when `display_name` is missing

---

## [0.1.1] - 2026-05-28

### Added
- Token & Cost chart — stacked bar chart showing input vs output tokens per LLM turn
- Cost breakdown per span in the Trajectories view
- User View — chat-bubble replay of the full conversation with agent name on each turn
- Sidebar Activity Bar panel with Conversations and Responses sections
- Onboarding / setup webview panel (⚙ gear button)
- API key stored securely in VS Code SecretStorage
- One-click refresh button in the sidebar header

### Changed
- Extension renamed to **Foundry Trace Inspector**

---

## [0.1.0] - 2026-05-20

### Added
- Initial release
- Trajectories view — collapsible span tree with Gantt-style timing bars, duration, and token counts
- Fetch and display agent traces from Microsoft Foundry via the OpenAI Responses API
- API key and Entra ID (`DefaultAzureCredential`) authentication
- VS Code settings for project endpoint, auth method, and max runs to list
