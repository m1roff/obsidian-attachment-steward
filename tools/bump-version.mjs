// Sets the plugin version in every file that carries it: manifest.json, package.json,
// package-lock.json (both places) and versions.json (adds "<version>": "<minAppVersion>",
// an existing entry is never rewritten, it is the history of releases).
// Usage: node tools/bump-version.mjs 0.1.2
import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
  console.error("Usage: node tools/bump-version.mjs x.y.z");
  process.exit(1);
}

/** Keeps the indentation the file already has. */
function edit(path, change) {
  const text = readFileSync(path, "utf8");
  const indent = text.match(/^([ \t]+)\S/m)?.[1] ?? "  ";
  const data = JSON.parse(text);
  change(data);
  writeFileSync(path, `${JSON.stringify(data, null, indent)}\n`);
}

let minAppVersion = "";
edit("manifest.json", (manifest) => {
  manifest.version = version;
  minAppVersion = manifest.minAppVersion;
});
edit("package.json", (pkg) => {
  pkg.version = version;
});
edit("package-lock.json", (lock) => {
  lock.version = version;
  if (lock.packages?.[""]) lock.packages[""].version = version;
});
edit("versions.json", (versions) => {
  if (!(version in versions)) versions[version] = minAppVersion;
});

console.log(`Version set to ${version} (minAppVersion ${minAppVersion}).`);
