# Changelog

All notable changes to **Foundry Trace Inspector** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- Fetch and display agent traces from Azure AI Foundry via the OpenAI Responses API
- API key and Entra ID (`DefaultAzureCredential`) authentication
- VS Code settings for project endpoint, auth method, and max runs to list
