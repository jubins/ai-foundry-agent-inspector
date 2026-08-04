#!/usr/bin/env node
// Point every dependency on `foundry-trace-inspector-core` at the given version.
// Used by the publish workflow so the extension and CLI always depend on the
// core version they are released alongside (lockstep versioning).
const fs = require("fs");
const path = require("path");

const version = process.argv[2];
if (!version) {
  console.error("Usage: sync-core-dep-version.js <version>");
  process.exit(1);
}

const CORE = "foundry-trace-inspector-core";
const manifests = [
  path.resolve(__dirname, "..", "package.json"),
  path.resolve(__dirname, "..", "packages", "cli", "package.json"),
];

for (const file of manifests) {
  const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
  let changed = false;
  for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
    if (pkg[field] && pkg[field][CORE]) {
      pkg[field][CORE] = `^${version}`;
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
    console.log(`Updated ${CORE} -> ^${version} in ${path.relative(process.cwd(), file)}`);
  }
}
