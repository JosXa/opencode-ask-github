import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin/tool";
import { handleAsk, prepareRepository } from "./src/commands/ask.js";
import { handleList } from "./src/commands/list.js";
import { handleRemove } from "./src/commands/remove.js";
import type { CommandContext } from "./src/types.js";

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
        description: "Prepare a GitHub repo and submit its tool result",
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
          const text = await handleAsk(input.arguments);
          // Command admission retains this array, so replace its contents in place.
          output.parts.splice(
            0,
            output.parts.length,
            { type: "text", text },
            ...output.parts.filter((part) => part.type !== "text"),
          );
          return;
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
          return prepareRepository(args.repo);
        },
      }),
    },
  };
};
