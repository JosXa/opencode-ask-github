import { beforeEach, expect, mock, test } from "bun:test";
import assert from "node:assert/strict";

let cloned = false;
let failure = false;
let preparations = 0;
mock.module("./src/config.js", () => ({
  loadConfig: () => ({ aliases: { oc: "anomalyco/opencode" } }),
  getPromptConfig: () => ({ agent: "explore" }),
}));
mock.module("./src/repo-manager.js", () => ({
  listClonedRepos: () => [],
  getRepoPath: () => "/cache/anomalyco/opencode",
  isCloned: () => cloned,
  cloneRepo: async () => {
    preparations++;
    return { success: !failure, error: "offline" };
  },
  updateRepo: async () => {
    preparations++;
    return { success: !failure, error: "offline" };
  },
  removeRepo: () => true,
}));

const { AskGithubPlugin } = await import("./index.js");
const plugin = await AskGithubPlugin({} as never);
const before = plugin["command.execute.before"];
const tool = plugin.tool?.["gh-ask"];
assert(before);
assert(tool);

beforeEach(() => {
  cloned = false;
  failure = false;
  preparations = 0;
});

test.each([
  "oc",
  "anomalyco/opencode",
  "https://github.com/anomalyco/opencode",
])("prepares %s and admits one user message with result, question, and attachments", async (repo) => {
  const question = "Explain $&\n\nKeep  $ARGUMENTS and 日本語.";
  const file = { type: "file", mime: "text/plain", url: "file:///test" };
  const output = { parts: [{ type: "text", text: "old template" }, file] };
  const admittedParts = output.parts;
  await before(
    { command: "gh-ask", sessionID: "ses_test", arguments: ` ${repo}\t${question} ` },
    output as never,
  );
  expect(preparations).toBe(1);
  expect(output.parts).toBe(admittedParts);
  expect(admittedParts).toEqual([
    {
      type: "text",
      text: `anomalyco/opencode is ready at /cache/anomalyco/opencode.\nUse the @explore subagent to answer questions about this codebase.\n\n${question}`,
    },
    file,
  ]);
});

test.each([
  "",
  "   ",
  "unknown-alias",
])("submits the same result as the tool for %j", async (repo) => {
  const output = { parts: [] };
  await before({ command: "gh-ask", sessionID: "ses_test", arguments: repo }, output);
  expect(output.parts).toEqual([
    { type: "text", text: await tool.execute({ repo: repo.trim() }, {} as never) },
  ]);
  expect(preparations).toBe(0);
});

test.each([false, true])("submits operation failures (cloned: %s)", async (existing) => {
  cloned = existing;
  failure = true;
  const output = { parts: [] };
  await before({ command: "gh-ask", sessionID: "ses_test", arguments: "oc" }, output);
  expect(preparations).toBe(1);
  expect(output.parts).toEqual([
    {
      type: "text",
      text: `Failed to ${existing ? "update" : "clone"} anomalyco/opencode: offline`,
    },
  ]);
});
