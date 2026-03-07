import type { PluginInput } from "@opencode-ai/plugin";

export type AliasMap = Record<string, string>;

export interface PromptConfig {
  /**
   * The subagent suggested in tool results for repository exploration.
   * Default: "explore"
   */
  agent: string;
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
