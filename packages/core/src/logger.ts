/**
 * Minimal logging sink so core stays independent of any host's logging
 * (VS Code OutputChannel, console, a file, etc.). Hosts pass their own
 * implementation; when omitted, core stays silent.
 */
export interface Logger {
  appendLine(message: string): void;
}

/** A no-op logger used when a host does not supply one. */
export const noopLogger: Logger = {
  appendLine() {
    /* intentionally silent */
  },
};
