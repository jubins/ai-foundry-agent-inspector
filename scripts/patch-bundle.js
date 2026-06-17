#!/usr/bin/env node
// The Azure SDK contains ESM code that uses import.meta.url. When esbuild bundles
// it into CJS it sometimes drops the assignment, leaving the variable undefined.
// The pattern in the bundle looks like:
//   var nx, ru, EQ;
//   isNode && (nx = createRequire(ru), ru = fileURLToPath(ru), EQ = dirname(ru))
// We replace the entire block with safe CJS equivalents.
const fs = require("fs");
const path = require("path");

const bundlePath = path.join(__dirname, "../out/extension.js");
let code = fs.readFileSync(bundlePath, "utf8");

// Find and replace the problematic pattern:
// createRequire(undefinedVar) → createRequire(__filename)
// fileURLToPath(undefinedVar) → __filename  (already a path, no conversion needed)
// dirname(undefinedVar)       → __dirname
const before = code.length;

// Replace createRequire calls where arg is a short var (not __filename)
code = code.replace(
  /\(0,\w+\.createRequire\)\((\w{1,4})\)/g,
  (match, varname) => varname === "__filename" ? match : "(0,require('module').createRequire)(__filename)"
);

// Replace fileURLToPath(shortVar) → __filename
code = code.replace(
  /\(0,\w+\.fileURLToPath\)\((\w{1,4})\)/g,
  (match, varname) => varname === "__filename" ? "__filename" : "__filename"
);

// Replace dirname(shortVar) → __dirname
code = code.replace(
  /\(0,\w+\.dirname\)\((\w{1,4})\)/g,
  (match, varname) => varname === "__filename" || varname === "__dirname" ? match : "__dirname"
);

fs.writeFileSync(bundlePath, code);

// Verify no undefined vars remain in that pattern
const remaining = code.match(/fileURLToPath\)\(\w{1,4}\)/g) || [];
const bad = remaining.filter(m => !m.includes("__filename"));
if (bad.length > 0) {
  console.error("ERROR: unfixed fileURLToPath calls remain:", bad);
  process.exit(1);
}

console.log(`Patched: ${before} → ${code.length} bytes. OK`);
