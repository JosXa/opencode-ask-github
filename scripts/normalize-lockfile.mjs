import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import ts from "typescript";

const path = new URL("../bun.lock", import.meta.url);
const source = await readFile(path, "utf8");
// Empty npm resolution fields make Bun use the installer's configured registry.
const normalized = source.replace(/(\["[^"]+", )"https?:\/\/[^"]+"(?=,)/g, '$1""');
const parse = (text) => ts.parseConfigFileTextToJson("bun.lock", text).config;
const before = parse(source);
const after = parse(normalized);
for (const [name, entry] of Object.entries(before.packages)) {
  assert.deepEqual(after.packages[name], [entry[0], "", ...entry.slice(2)]);
}
if (process.argv.includes("--write")) {
  await writeFile(path, normalized);
} else {
  assert.equal(source, normalized, "Run bun run lock:normalize to remove registry URLs");
}
console.log("Lockfile registry portability checked; versions and integrity retained");
