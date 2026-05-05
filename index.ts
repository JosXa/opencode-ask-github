import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { handleAsk } from "./src/commands/ask";
import { handleList } from "./src/commands/list";
import { handleRemove } from "./src/commands/remove";
import { getPromptConfig, loadConfig } from "./src/config";
import { cloneRepo, getRepoPath, isCloned, listClonedRepos, updateRepo } from "./src/repo-manager";
import { formatRepo, parseRepoInput } from "./src/repo-parser";
import type { CommandContext } from "./src/types";

/** Marker error to indicate command was handled */
const COMMAND_HANDLED_MARKER = "__GH_COMMAND_HANDLED__";

interface CommandInput {
  command: string;
  sessionID: string;
  arguments: string;
}

interface CommandOutput {
  parts: Array<{ type: string; text?: string; [key: string]: unknown }>;
}

export const AskGithubPlugin: Plugin = async ({ client, $, directory }) => {
  return {
    config: async (cfg) => {
      cfg.command ??= {};
      cfg.command["gh-ask"] = {
        template: "",
        description: "Clone/locate a GitHub repo and analyze with AI",
      };
      cfg.command["gh-list"] = {
        template: "",
        description: "List cloned GitHub repositories and aliases",
      };
      cfg.command["gh-remove"] = {
        template: "",
        description: "Remove a cloned GitHub repository from cache",
      };
    },

    "command.execute.before": async (input: CommandInput, output: CommandOutput) => {
      const ctx: CommandContext = {
        client,
        $,
        directory,
        sessionId: input.sessionID,
      };

      try {
        if (input.command === "gh-ask") {
          await handleAsk(input.arguments, ctx);
          output.parts.length = 0;
          throw new Error(COMMAND_HANDLED_MARKER);
        }

        if (input.command === "gh-list") {
          await handleList(ctx);
          output.parts.length = 0;
          throw new Error(COMMAND_HANDLED_MARKER);
        }

        if (input.command === "gh-remove") {
          await handleRemove(input.arguments, ctx);
          output.parts.length = 0;
          throw new Error(COMMAND_HANDLED_MARKER);
        }
      } catch (error) {
        // Re-throw marker error to signal command was handled
        if (error instanceof Error && error.message === COMMAND_HANDLED_MARKER) {
          throw error;
        }
        // Re-throw other errors
        throw error;
      }
    },

    tool: {
      "gh-ask": tool({
        description:
          "Prepare a GitHub repo for exploration. Clones or updates locally. Accepts owner/repo, URLs, or aliases.",
        args: {
          repo: tool.schema.string("Repository (owner/repo, URL, or alias)"),
        },
        async execute(args) {
          const config = loadConfig();
          const promptConfig = getPromptConfig(config);
          const clonedRepos = listClonedRepos();
          const result = parseRepoInput(args.repo, config.aliases, clonedRepos);

          if (!result.repoInfo) {
            const aliases = Object.entries(config.aliases);
            const aliasHint =
              aliases.length > 0
                ? `\nConfigured aliases: ${aliases.map(([a, r]) => `${a}=${r}`).join(", ")}`
                : "";
            return `Could not resolve repository: ${args.repo}${aliasHint}`;
          }

          const info = result.repoInfo;
          const display = formatRepo(info);
          const localPath = getRepoPath(info);

          if (isCloned(info)) {
            const updateResult = await updateRepo(info);
            if (!updateResult.success) {
              return `Failed to update ${display}: ${updateResult.error}`;
            }
          } else {
            const cloneResult = await cloneRepo(info);
            if (!cloneResult.success) {
              return `Failed to clone ${display}: ${cloneResult.error}`;
            }
          }

          return `${display} is ready at ${localPath}.\nUse the @${promptConfig.agent} subagent to answer questions about this codebase.`;
        },
      }),
    },
  };
};
