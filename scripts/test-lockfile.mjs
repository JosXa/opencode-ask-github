import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = await mkdtemp(join(tmpdir(), "ask-github-lock-"));
for (const file of ["package.json", "bun.lock"])
  await copyFile(new URL(`../${file}`, import.meta.url), join(root, file));
const before = await readFile(join(root, "bun.lock"), "utf8");
const result = spawnSync(
  "bun",
  [
    "install",
    "--frozen-lockfile",
    "--ignore-scripts",
    "--cache-dir",
    join(root, "cache"),
    "--verbose",
  ],
  {
    cwd: root,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
  },
);
// Keep only registry origins from verbose output; never print request headers or credentials.
const requestLines = `${result.stdout}\n${result.stderr}`
  .split("\n")
  .filter((line) => /\bGET https?:\/\//.test(line))
  .join("\n");
const origins = [
  ...new Set(
    [...requestLines.matchAll(/https?:\/\/[^\s"<>]+/g)].map(([url]) => new URL(url).origin),
  ),
].sort();
assert.equal(
  result.status,
  0,
  `Frozen install failed (${result.status}); origins: ${origins.join(", ")}`,
);
assert.equal(await readFile(join(root, "bun.lock"), "utf8"), before);
const registry = spawnSync("npm", ["config", "get", "registry"], { encoding: "utf8" });
assert.equal(registry.status, 0);
assert.deepEqual(origins, [new URL(registry.stdout.trim()).origin]);
const evidence = { frozen: true, freshCache: true, registryOrigins: origins };
await writeFile(join(root, "evidence.json"), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ ...evidence, root }));
