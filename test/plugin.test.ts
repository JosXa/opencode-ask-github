import { describe, expect, test } from "bun:test";
import type { Plugin } from "@opencode/plugin";
import AskGithubPlugin, { createAskGithubPlugin, type PluginDependencies } from "../index";
import type { ClonedRepo, Config, RepoInfo } from "../src/types";

interface RegisteredTool {
  name: string;
  execute(input: unknown): Promise<{ content?: string }>;
}

interface CommandRecord {
  name: string;
  execute(input: {
    sessionID: string;
    prompt: { text: string; files?: { uri: string }[] };
    delivery: string;
  }): Promise<void>;
  description?: string;
}

function setup(overrides: Partial<PluginDependencies> = {}) {
  const config: Config = { aliases: { oc: "anomalyco/opencode" } };
  const cloned: ClonedRepo[] = [];
  const calls = { clone: 0, update: 0, remove: 0 };
  const disposed: string[] = [];
  const dependencies: PluginDependencies = {
    loadConfig: () => config,
    listClonedRepos: () => cloned,
    getRepoPath: (info) => `/cache/${info.owner}/${info.repo}`,
    isCloned: () => false,
    cloneRepo: async () => {
      calls.clone++;
      return { success: true };
    },
    updateRepo: async () => {
      calls.update++;
      return { success: true };
    },
    removeRepo: () => {
      calls.remove++;
      return true;
    },
    ...overrides,
  };
  const commands = new Map<string, CommandRecord>();
  const tools = new Map<string, RegisteredTool>();
  const prompts: Array<{ text: string; files?: { uri: string }[]; delivery: string }> = [];
  const context = {
    session: {
      prompt: async (input: (typeof prompts)[number]) => {
        expect(input).toStrictEqual(JSON.parse(JSON.stringify(input)));
        prompts.push(input);
      },
    },
    command: {
      transform: async (transform: (draft: unknown) => void) => {
        transform({
          add: (command: CommandRecord) => {
            commands.set(command.name, command);
          },
        });
        return {
          async dispose() {
            disposed.push("command");
          },
        };
      },
    },
    tool: {
      transform: async (transform: (draft: unknown) => void) => {
        transform({ add: (tool: RegisteredTool) => tools.set(tool.name, tool) });
        return {
          async dispose() {
            disposed.push("tool");
          },
        };
      },
    },
  } as unknown as Plugin.Context;
  return {
    plugin: createAskGithubPlugin(dependencies),
    context,
    commands,
    tools,
    calls,
    disposed,
    prompts,
  };
}

describe("OpenCode V2 plugin", () => {
  test("has the required default Plugin.define shape", () => {
    expect(AskGithubPlugin.id).toBe("opencode-ask-github");
    expect(typeof AskGithubPlugin.setup).toBe("function");
  });

  test("registers all commands and tools through V2 transforms", async () => {
    const fixture = setup();
    await fixture.plugin.setup(fixture.context);

    expect([...fixture.commands.keys()]).toEqual(["gh-ask", "gh-list", "gh-remove"]);
    for (const text of ["", "owner/repo $& $ARGUMENTS"]) {
      await fixture.commands.get("gh-ask")?.execute({
        sessionID: "ses_test",
        prompt: { text, files: [{ uri: "file:///test" }] },
        delivery: "queue",
      });
      expect(fixture.prompts.at(-1)?.text).toEndWith(`Arguments: ${text}`);
      expect(fixture.prompts.at(-1)?.text).toContain("empty repo");
      expect(fixture.prompts.at(-1)?.files).toEqual([{ uri: "file:///test" }]);
      expect(fixture.prompts.at(-1)?.delivery).toBe("queue");
    }
    await fixture.commands.get("gh-list")?.execute({
      sessionID: "ses_test",
      prompt: { text: "", files: undefined },
      delivery: "queue",
    });
    expect(fixture.prompts.at(-1)).not.toHaveProperty("files");
    expect([...fixture.tools.keys()]).toEqual(["gh-ask", "gh-list", "gh-remove"]);
  });

  test("resolves an alias, clones it, and preserves the configured agent hint", async () => {
    const fixture = setup({
      loadConfig: () => ({ aliases: { oc: "anomalyco/opencode" }, prompt: { agent: "review" } }),
    });
    await fixture.plugin.setup(fixture.context);

    const result = await fixture.tools.get("gh-ask")?.execute({ repo: "oc" });
    expect(fixture.calls.clone).toBe(1);
    expect(result?.content).toBe(
      "anomalyco/opencode is ready at /cache/anomalyco/opencode.\nUse the @review subagent to answer questions about this codebase.",
    );
  });

  test("preserves command usage output for missing arguments", async () => {
    const fixture = setup();
    await fixture.plugin.setup(fixture.context);

    const ask = await fixture.tools.get("gh-ask")?.execute({ repo: "" });
    const remove = await fixture.tools.get("gh-remove")?.execute({ repo: "" });
    expect(ask?.content).toContain("Usage: /gh-ask <repo> [question]");
    expect(ask?.content).toContain("`oc` → `anomalyco/opencode`");
    expect(remove?.content).toBe("Usage: `/gh-remove <repo>`");
  });

  test("updates existing repositories and reports update failures accurately", async () => {
    const fixture = setup({
      isCloned: () => true,
      updateRepo: async () => ({ success: false, error: "offline" }),
    });
    await fixture.plugin.setup(fixture.context);

    const result = await fixture.tools.get("gh-ask")?.execute({ repo: "owner/repo" });
    expect(result?.content).toBe("Failed to update owner/repo: offline");
  });

  test("lists aliases and cloned repositories deterministically", async () => {
    const fixture = setup({
      listClonedRepos: () => [
        {
          owner: "owner",
          repo: "repo",
          path: "/cache/owner/repo",
          lastModified: new Date(),
        },
      ],
    });
    await fixture.plugin.setup(fixture.context);

    const result = await fixture.tools.get("gh-list")?.execute({});
    expect(result?.content).toContain("`owner/repo`");
    expect(result?.content).toContain("`oc` → `anomalyco/opencode`");
  });

  test("removes a uniquely resolved cached repository", async () => {
    const info: RepoInfo = {
      owner: "owner",
      repo: "repo",
      url: "https://github.com/owner/repo",
      cloneUrl: "git@github.com:owner/repo.git",
    };
    const fixture = setup({ isCloned: (candidate) => candidate.repo === info.repo });
    await fixture.plugin.setup(fixture.context);

    const result = await fixture.tools.get("gh-remove")?.execute({ repo: "owner/repo" });
    expect(fixture.calls.remove).toBe(1);
    expect(result?.content).toBe("Removed `owner/repo` from cache.");
  });

  test("disposes command and tool transforms once on unload", async () => {
    const fixture = setup();
    const cleanup = await fixture.plugin.setup(fixture.context);

    expect(cleanup).toBeFunction();
    if (cleanup) await cleanup();
    if (cleanup) await cleanup();
    expect(fixture.disposed).toEqual(["tool", "command"]);
  });

  test("disposes the command transform after partial setup failure", async () => {
    const disposed: string[] = [];
    const context = {
      command: {
        async transform() {
          return {
            async dispose() {
              disposed.push("command");
            },
          };
        },
      },
      tool: {
        async transform() {
          throw new Error("tool registration failed");
        },
      },
    };

    await expect(createAskGithubPlugin().setup(context as never)).rejects.toThrow(
      "tool registration failed",
    );
    expect(disposed).toEqual(["command"]);
  });
});
