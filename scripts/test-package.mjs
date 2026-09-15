import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = await mkdtemp(join(tmpdir(), "ask-github-package-"));
const source = fileURLToPath(new URL("..", import.meta.url));
const run = (command, args, cwd) => {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", timeout: 120_000 });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  return result.stdout;
};
const packed = JSON.parse(run("npm", ["pack", "--json", "--pack-destination", root], source))[0];
assert.deepEqual(packed.files.map((file) => file.path).sort(), [
  "LICENSE",
  "README.md",
  "dist/index.js",
  "dist/index.js.map",
  "package.json",
]);
await writeFile(
  join(root, "package.json"),
  '{"name":"package-test","private":true,"type":"module"}',
);
run(
  "npm",
  [
    "install",
    "--engine-strict=true",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    join(root, packed.filename),
  ],
  root,
);
const installed = join(root, "node_modules", "opencode-ask-github");
const manifest = JSON.parse(await readFile(join(installed, "package.json"), "utf8"));
assert.equal(manifest.publishConfig.tag, "opencode-v2");
assert.equal(manifest.dependencies, undefined);
assert.equal(manifest.peerDependencies, undefined);
assert.equal(manifest.optionalDependencies, undefined);
const lock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
assert.deepEqual(Object.keys(lock.packages).sort(), ["", "node_modules/opencode-ask-github"]);
run(
  process.execPath,
  [fileURLToPath(new URL("test-node.mjs", import.meta.url)), join(installed, "dist/index.js")],
  root,
);
await writeFile(
  join(root, "evidence.json"),
  JSON.stringify({ node: process.version, engineStrict: true, packed, installed }, null, 2),
);
console.log(
  `${process.version}: engine-strict tarball install and Node tests passed; no runtime dependencies: ${root}`,
);
if (process.argv[2]) {
  console.log(
    run(
      process.execPath,
      [fileURLToPath(new URL("test-native.mjs", import.meta.url)), process.argv[2], installed],
      root,
    ),
  );
}
