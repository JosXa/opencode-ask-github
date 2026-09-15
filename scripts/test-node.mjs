import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fixture } from "./test-fixture.mjs";

if (!process.env.ASK_GITHUB_FIXTURE) {
  const sandbox = await fixture();
  const entry = resolve(
    process.argv[2] ?? fileURLToPath(new URL("../dist/index.js", import.meta.url)),
  );
  const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), entry], {
    ...sandbox,
    stdio: "inherit",
    timeout: 30_000,
  });
  assert.equal(child.status, 0, child.error?.message);
  console.log(`Node artifact evidence: ${sandbox.root}`);
} else {
  assert.equal(typeof globalThis.Bun, "undefined");
  const module = await import(pathToFileURL(process.argv[2]).href);
  assert.deepEqual(Object.keys(module), ["default"]);
  const plugin = module.default;
  const tools = new Map();
  const commands = new Map();
  const prompts = [];
  const disposed = [];
  const cleanup = await plugin.setup({
    tool: {
      async transform(fn) {
        fn({ add: (tool) => tools.set(tool.name, tool) });
        return { dispose: async () => disposed.push("tool") };
      },
    },
    command: {
      async transform(fn) {
        fn({ add: (command) => commands.set(command.name, command) });
        return { dispose: async () => disposed.push("command") };
      },
    },
    session: { prompt: async (input) => prompts.push(input) },
  });
  const call = async (name, input = {}) => (await tools.get(name).execute(input)).content;
  assert.deepEqual([...tools.keys()], ["gh-ask", "gh-list", "gh-remove"]);
  for (const tool of tools.values()) assert.equal(tool.options.codemode, true);
  assert.match(await call("gh-ask", { repo: "" }), /Usage:/);
  assert.match(await call("gh-ask", { repo: "fixture" }), /fixture\/repo is ready/);
  assert.match(await call("gh-list"), /`fixture\/repo`/);
  assert.match(await call("gh-ask", { repo: "fixture" }), /is ready/);
  await writeFile(join(process.env.ASK_GITHUB_FIXTURE, "git-mode"), "fallback");
  assert.match(await call("gh-ask", { repo: "fixture" }), /is ready/);
  await writeFile(join(process.env.ASK_GITHUB_FIXTURE, "git-mode"), "fail");
  assert.match(await call("gh-ask", { repo: "fixture" }), /Failed to update.*fixture git failure/);
  assert.match(
    await call("gh-ask", { repo: "fixture/failure" }),
    /Failed to clone.*fixture git failure/,
  );
  assert.match(await call("gh-remove", { repo: "fixture" }), /Removed `fixture\/repo`/);
  assert.match(await call("gh-remove", { repo: "fixture" }), /is not cloned/);
  assert.match(await call("gh-remove", { repo: "" }), /Usage:/);
  for (const name of commands.keys()) {
    await commands.get(name).execute({
      sessionID: "ses_fixture",
      prompt: { text: "fixture $& $ARGUMENTS", files: undefined },
      delivery: "queue",
    });
    const prompt = prompts.at(-1);
    assert.equal(prompt.sessionID, "ses_fixture");
    assert.equal(prompt.delivery, "queue");
    assert.ok(!Object.hasOwn(prompt, "files"));
    if (name !== "gh-list") assert.ok(prompt.text.endsWith("fixture $& $ARGUMENTS"));
  }
  const calls = (await readFile(join(process.env.ASK_GITHUB_FIXTURE, "git.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map(JSON.parse);
  assert.deepEqual(calls[0].slice(0, 4), [
    "clone",
    "--depth",
    "1",
    "git@github.com:fixture/repo.git",
  ]);
  assert.ok(calls.some((args) => args.includes("fetch")));
  assert.ok(calls.some((args) => args.includes("symbolic-ref")));
  assert.ok(calls.some((args) => args.includes("reset") && args.at(-1) === "origin/main"));
  await cleanup();
  await cleanup();
  assert.deepEqual(disposed, ["tool", "command"]);
  console.log(
    `${process.version}: built plugin tools, git operations, commands, and disposal passed`,
  );
}
