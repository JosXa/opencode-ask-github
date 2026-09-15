import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = await mkdtemp(join(tmpdir(), "ask-github-build-path-"));
const source = join(root, "source with spaces ünicode 日本語");
await mkdir(source);
for (const name of [
  "package.json",
  "bun.lock",
  "index.ts",
  "src",
  "scripts",
  "tsconfig.json",
  "tsconfig.build.json",
  "LICENSE",
  "README.md",
])
  await cp(new URL(`../${name}`, import.meta.url), join(source, name), { recursive: true });
const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: source, encoding: "utf8", timeout: 120_000 });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}\n${result.error ?? ""}`);
  return result.stdout;
};
run("bun", ["install", "--frozen-lockfile", "--ignore-scripts"]);
run("bun", ["run", "build"]);
const packageResult = run(process.execPath, [join(source, "scripts/test-package.mjs")]);
await writeFile(
  join(root, "evidence.json"),
  JSON.stringify({ node: process.version, source, packageResult }, null, 2),
);
console.log(`Source path build and strict package install passed: ${source}\n${packageResult}`);
