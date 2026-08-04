export interface ParsedArgs {
  command?: string;
  positionals: string[];
  flags: Record<string, string | boolean>;
}

/**
 * Tiny hand-rolled argument parser so the CLI ships with no third-party
 * parsing dependency. Supports `--flag value`, `--flag=value`, and boolean
 * `--flag`.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const body = arg.slice(2);
      const eq = body.indexOf("=");
      if (eq !== -1) {
        flags[body.slice(0, eq)] = body.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          flags[body] = next;
          i++;
        } else {
          flags[body] = true;
        }
      }
    } else {
      positionals.push(arg);
    }
  }

  const [command, ...rest] = positionals;
  return { command, positionals: rest, flags };
}

export function flagString(
  flags: Record<string, string | boolean>,
  name: string
): string | undefined {
  const v = flags[name];
  return typeof v === "string" ? v : undefined;
}

export function flagBool(
  flags: Record<string, string | boolean>,
  name: string
): boolean {
  return flags[name] === true || flags[name] === "true";
}
