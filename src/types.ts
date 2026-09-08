export type AliasMap = Record<string, string>;

export interface PromptConfig {
  /** The subagent suggested in tool results for repository exploration. */
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
  cloneUrl: string;
}

export interface ClonedRepo {
  owner: string;
  repo: string;
  path: string;
  lastModified: Date;
}
