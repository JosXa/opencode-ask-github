import type { PluginInput } from "@opencode-ai/plugin";

export type AliasMap = Record<string, string>;

export interface PromptConfig {
  /**
   * The instruction that tells the AI how to delegate. Use {path} placeholder.
   * Default: "Delegate to an @explore subagent to answer the following question about the repository at `{path}`:"
   */
  delegateInstruction: string;
  /**
   * Template for the explore prompt. Use {question} placeholder.
   * Default: "{question}"
   */
  exploreTemplate: string;
}

export interface Config {
  aliases: AliasMap;
  prompt?: Partial<PromptConfig>;
}

export interface RepoInfo {
  owner: string;
  repo: string;
  url: string;
}

export interface ClonedRepo {
  owner: string;
  repo: string;
  path: string;
  lastModified: Date;
}

export interface CommandContext {
  client: PluginInput["client"];
  $: PluginInput["$"];
  directory: string;
  sessionId: string;
}
