import * as Plugin from "@opencode/plugin/promise/plugin";
import { renderAskUsage, renderUnresolvedRepo } from "./src/commands/ask.js";
import { renderRepoList } from "./src/commands/list.js";
import { removeRepository } from "./src/commands/remove.js";
import { getPromptConfig, loadConfig } from "./src/config.js";
import {
  cloneRepo,
  getRepoPath,
  isCloned,
  listClonedRepos,
  updateRepo,
} from "./src/repo-manager.js";
import { formatRepo, parseRepoInput } from "./src/repo-parser.js";
import type { ClonedRepo, Config, RepoInfo } from "./src/types.js";

const ASK_INPUT_SCHEMA = {
  type: "object",
  properties: {
    repo: { type: "string", description: "Repository (owner/repo, URL, or alias)" },
  },
  required: ["repo"],
  additionalProperties: false,
} as const;

const REMOVE_INPUT_SCHEMA = {
  type: "object",
  properties: {
    repo: {
      type: "string",
      description: "Repository (owner/repo, URL, alias, or clone-name substring)",
    },
  },
  required: ["repo"],
  additionalProperties: false,
} as const;

const EMPTY_INPUT_SCHEMA = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const;

export interface PluginDependencies {
  loadConfig: () => Config;
  listClonedRepos: () => ClonedRepo[];
  getRepoPath: (info: RepoInfo) => string;
  isCloned: (info: RepoInfo) => boolean;
  cloneRepo: (info: RepoInfo) => Promise<{ success: boolean; error?: string }>;
  updateRepo: (info: RepoInfo) => Promise<{ success: boolean; error?: string }>;
  removeRepo: (info: RepoInfo) => boolean;
}

const runtimeDependencies: PluginDependencies = {
  loadConfig,
  listClonedRepos,
  getRepoPath,
  isCloned,
  cloneRepo,
  updateRepo,
  removeRepo: removeRepository,
};

function requiredRepo(input: unknown): string {
  if (
    typeof input !== "object" ||
    input === null ||
    !("repo" in input) ||
    typeof input.repo !== "string"
  ) {
    throw new Error("repo must be a string");
  }
  return input.repo;
}

export function createAskGithubPlugin(dependencies: PluginDependencies = runtimeDependencies) {
  return Plugin.define({
    id: "opencode-ask-github",
    setup: async (ctx) => {
      const registrations: Array<{ dispose(): Promise<void> }> = [];
      try {
        registrations.push(
          await ctx.command.transform((commands) => {
            const add = (name: string, description: string, template: string) => {
              commands.add({
                name,
                description,
                execute: async ({ sessionID, prompt, delivery }) => {
                  // The command schema materializes undefined optionals; the wire API rejects them.
                  const input = JSON.parse(
                    JSON.stringify({
                      sessionID,
                      delivery,
                      ...prompt,
                      text: template.replaceAll("$ARGUMENTS", () => prompt.text),
                    }),
                  ) as Parameters<typeof ctx.session.prompt>[0];
                  await ctx.session.prompt(input);
                },
              });
            };
            add(
              "gh-ask",
              "Clone/locate a GitHub repo and analyze with AI",
              "If Arguments is empty, call gh-ask with an empty repo and return its result exactly. Otherwise, use gh-ask with the first argument as the repository, then answer the remaining question about it. Arguments: $ARGUMENTS",
            );
            add(
              "gh-list",
              "List cloned GitHub repositories and aliases",
              "Call the gh-list tool and return its result exactly, without adding commentary.",
            );
            add(
              "gh-remove",
              "Remove a cloned GitHub repository from cache",
              "Call gh-remove with the complete Arguments value as its repository and return its result exactly, including when Arguments is empty: $ARGUMENTS",
            );
          }),
        );

        registrations.push(
          await ctx.tool.transform((tools) => {
            tools.add({
              name: "gh-ask",
              description:
                "Prepare a GitHub repo for exploration. Clones or updates locally. Accepts owner/repo, URLs, or aliases.",
              input: ASK_INPUT_SCHEMA,
              options: { codemode: true },
              execute: async (input) => {
                const repo = requiredRepo(input);
                const config = dependencies.loadConfig();
                if (repo.trim() === "") return { content: renderAskUsage(config.aliases) };
                const promptConfig = getPromptConfig(config);
                const result = parseRepoInput(repo, config.aliases, dependencies.listClonedRepos());

                if (!result.repoInfo) {
                  return { content: renderUnresolvedRepo(repo, config.aliases) };
                }

                const info = result.repoInfo;
                const display = formatRepo(info);
                const localPath = dependencies.getRepoPath(info);
                const wasCloned = dependencies.isCloned(info);
                const operation = wasCloned
                  ? await dependencies.updateRepo(info)
                  : await dependencies.cloneRepo(info);

                if (!operation.success) {
                  const verb = wasCloned ? "update" : "clone";
                  return { content: `Failed to ${verb} ${display}: ${operation.error}` };
                }

                return {
                  content: `${display} is ready at ${localPath}.\nUse the @${promptConfig.agent} subagent to answer questions about this codebase.`,
                };
              },
            });

            tools.add({
              name: "gh-list",
              description:
                "List repositories cached by opencode-ask-github and configured aliases.",
              input: EMPTY_INPUT_SCHEMA,
              options: { codemode: true },
              execute: async () => ({
                content: renderRepoList(dependencies.loadConfig(), dependencies.listClonedRepos()),
              }),
            });

            tools.add({
              name: "gh-remove",
              description: "Remove a repository from the opencode-ask-github cache.",
              input: REMOVE_INPUT_SCHEMA,
              options: { codemode: true },
              execute: async (input) => {
                const repo = requiredRepo(input);
                if (repo.trim() === "") return { content: "Usage: `/gh-remove <repo>`" };
                const config = dependencies.loadConfig();
                const result = parseRepoInput(repo, config.aliases, dependencies.listClonedRepos());
                if (!result.repoInfo) return { content: `Could not parse repository: \`${repo}\`` };

                const display = formatRepo(result.repoInfo);
                if (!dependencies.isCloned(result.repoInfo)) {
                  return { content: `Repository \`${display}\` is not cloned.` };
                }
                return {
                  content: dependencies.removeRepo(result.repoInfo)
                    ? `Removed \`${display}\` from cache.`
                    : `Failed to remove \`${display}\`.`,
                };
              },
            });
          }),
        );
      } catch (setupError) {
        const disposal = await Promise.allSettled(
          [...registrations].reverse().map((registration) => registration.dispose()),
        );
        const disposalErrors = disposal
          .filter((result): result is PromiseRejectedResult => result.status === "rejected")
          .map((result) => result.reason);
        if (disposalErrors.length > 0) throw new AggregateError([setupError, ...disposalErrors]);
        throw setupError;
      }

      let cleaned = false;
      return async () => {
        if (cleaned) return;
        cleaned = true;
        const disposal = await Promise.allSettled(
          [...registrations].reverse().map((registration) => registration.dispose()),
        );
        const errors = disposal
          .filter((result): result is PromiseRejectedResult => result.status === "rejected")
          .map((result) => result.reason);
        if (errors.length > 0)
          throw new AggregateError(errors, "Failed to dispose ask-github registrations");
      };
    },
  });
}

export const AskGithubPlugin = createAskGithubPlugin();
export default AskGithubPlugin;

export { renderAskUsage };
