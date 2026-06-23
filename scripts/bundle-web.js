#!/usr/bin/env node
const { build } = require("esbuild");
const path = require("path");

build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "out/extension.web.js",
  external: ["vscode"],
  format: "cjs",
  platform: "browser",
  minify: true,
  plugins: [
    {
      name: "web-client-alias",
      setup(build) {
        // Redirect ./client imports to client.web.ts (drops @azure/identity dependency)
        build.onResolve({ filter: /[/\\]client$/ }, (args) => {
          if (args.importer.includes("client.web")) { return; }
          return { path: path.resolve(__dirname, "../src/client.web.ts") };
        });

        // Stub out Node built-in modules that appear in unreachable SDK code paths
        // (datasets/models submodules never called by this extension on web).
        const nodeBuiltins = ["fs", "path", "stream", "buffer", "util", "events", "os", "crypto", "http", "https", "net", "tls", "zlib", "child_process"];
        const builtinFilter = new RegExp(`^(node:)?(${nodeBuiltins.join("|")})$`);
        build.onResolve({ filter: builtinFilter }, (args) => ({
          path: args.path,
          namespace: "node-stub",
        }));
        build.onLoad({ filter: /.*/, namespace: "node-stub" }, () => ({
          contents: "module.exports = {};",
          loader: "js",
        }));
      },
    },
  ],
}).catch(() => process.exit(1));
