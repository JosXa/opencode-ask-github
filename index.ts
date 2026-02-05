import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { handleAsk } from "./src/commands/ask";
import { handleList } from "./src/commands/list";
import { handleRemove } from "./src/commands/remove";
import { loadConfig, saveConfig } from "./src/config";
import { getRepoPath, isCloned, listClonedRepos } from "./src/repo-manager";
import { parseRepoInput } from "./src/repo-parser";
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
      "gh-alias-add": tool({
        description: "Add a GitHub repository alias for quick access with /gh-ask",
        args: {
          alias: tool.schema.string("Short name for the alias (e.g., 'sv')"),
          target: tool.schema.string("Repository in owner/repo format (e.g., 'sveltejs/svelte')"),
        },
        async execute(args) {
          const config = loadConfig();
          config.aliases[args.alias] = args.target;
          saveConfig(config);
          return `Added alias: ${args.alias} → ${args.target}`;
        },
      }),

      "gh-alias-remove": tool({
        description: "Remove a GitHub repository alias",
        args: {
          alias: tool.schema.string("The alias to remove"),
        },
        async execute(args) {
          const config = loadConfig();
          if (!config.aliases[args.alias]) {
            return `Alias '${args.alias}' not found`;
          }
          delete config.aliases[args.alias];
          saveConfig(config);
          return `Removed alias: ${args.alias}`;
        },
      }),

      "gh-alias-list": tool({
        description: "List all configured GitHub repository aliases",
        args: {},
        async execute() {
          const config = loadConfig();
          const entries = Object.entries(config.aliases);
          if (entries.length === 0) {
            return "No aliases configured";
          }
          return entries.map(([alias, repo]) => `${alias} → ${repo}`).join("\n");
        },
      }),

      "gh-repo-info": tool({
        description: "Get information about a GitHub repository (whether cloned, local path)",
        args: {
          repo: tool.schema.string("Repository URL, owner/repo, or alias"),
        },
        async execute(args) {
          const config = loadConfig();
          const clonedRepos = listClonedRepos();
          const result = parseRepoInput(args.repo, config.aliases, clonedRepos);

          if (!result.repoInfo) {
            return `Could not parse: ${args.repo}`;
          }

          const info = result.repoInfo;
          const cloned = isCloned(info);
          const path = getRepoPath(info);

          return JSON.stringify(
            {
              owner: info.owner,
              repo: info.repo,
              url: info.url,
              cloned,
              localPath: cloned ? path : null,
            },
            null,
            2,
          );
        },
      }),
    },
  };
};
