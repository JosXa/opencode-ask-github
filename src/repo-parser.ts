import type { AliasMap, ClonedRepo, RepoInfo } from "./types.ts";

const GITHUB_URL_REGEX =
  /^(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/;

const GITHUB_SSH_REGEX = /^git@github\.com:([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/;

const OWNER_REPO_REGEX = /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/;

function createRepoInfo(owner: string, repo: string): RepoInfo {
  return {
    owner,
    repo,
    url: `https://github.com/${owner}/${repo}`,
    cloneUrl: `git@github.com:${owner}/${repo}.git`,
  };
}

/**
 * Normalize a GitHub URL by stripping trailing .git, /tree/..., /blob/..., etc.
 */
function _normalizeUrl(url: string): string {
  return url
    .replace(/\.git$/, "")
    .replace(/\/(tree|blob)\/[^/]+.*$/, "")
    .replace(/\/$/, "");
}

export interface ParseResult {
  repoInfo: RepoInfo | null;
  matchedAlias?: { alias: string; target: string };
  matchedClonedRepo?: ClonedRepo;
}

/**
 * Parse various input formats into RepoInfo.
 * Supports: GitHub URLs, owner/repo pairs, aliases, and substring matches against cloned repos.
 */
export function parseRepoInput(
  input: string,
  aliases: AliasMap,
  clonedRepos: ClonedRepo[] = [],
): ParseResult {
  const trimmed = input.trim().toLowerCase();

  // Check if it's an exact alias match
  const exactAlias = Object.keys(aliases).find((a) => a.toLowerCase() === trimmed);
  if (exactAlias) {
    const target = aliases[exactAlias];
    const result = parseRepoInputSimple(target);
    return {
      repoInfo: result,
      matchedAlias: { alias: exactAlias, target },
    };
  }

  // Try GitHub URL format
  const urlMatch = input.trim().match(GITHUB_URL_REGEX);
  if (urlMatch) {
    const owner = urlMatch[1];
    const repo = urlMatch[2].replace(/\.git$/, "");
    return {
      repoInfo: createRepoInfo(owner, repo),
    };
  }

  // Try SSH URL format
  const sshMatch = input.trim().match(GITHUB_SSH_REGEX);
  if (sshMatch) {
    const owner = sshMatch[1];
    const repo = sshMatch[2].replace(/\.git$/, "");
    return {
      repoInfo: createRepoInfo(owner, repo),
    };
  }

  // Try owner/repo format
  const ownerRepoMatch = input.trim().match(OWNER_REPO_REGEX);
  if (ownerRepoMatch) {
    const owner = ownerRepoMatch[1];
    const repo = ownerRepoMatch[2];
    return {
      repoInfo: createRepoInfo(owner, repo),
    };
  }

  // Only do substring matching if there's no slash in the input
  // (slash indicates explicit owner/repo format that didn't match above)
  const hasSlash = input.includes("/");

  if (!hasSlash) {
    // Try substring match against cloned repos
    const matchingRepos = clonedRepos.filter((r) => {
      const repoLower = r.repo.toLowerCase();
      return repoLower.includes(trimmed);
    });

    if (matchingRepos.length === 1) {
      const match = matchingRepos[0];
      return {
        repoInfo: {
          ...createRepoInfo(match.owner, match.repo),
        },
        matchedClonedRepo: match,
      };
    }

    // Try substring match against aliases
    const matchingAliases = Object.entries(aliases).filter(([alias, target]) => {
      const aliasLower = alias.toLowerCase();
      const repoName = target.split("/")[1]?.toLowerCase() || "";
      return aliasLower.includes(trimmed) || repoName.includes(trimmed);
    });

    if (matchingAliases.length === 1) {
      const [alias, target] = matchingAliases[0];
      const result = parseRepoInputSimple(target);
      return {
        repoInfo: result,
        matchedAlias: { alias, target },
      };
    }
  }

  return { repoInfo: null };
}

/**
 * Simple parse without suggestions (used internally for alias targets).
 */
function parseRepoInputSimple(input: string): RepoInfo | null {
  const trimmed = input.trim();

  const urlMatch = trimmed.match(GITHUB_URL_REGEX);
  if (urlMatch) {
    const owner = urlMatch[1];
    const repo = urlMatch[2].replace(/\.git$/, "");
    return createRepoInfo(owner, repo);
  }

  const sshMatch = trimmed.match(GITHUB_SSH_REGEX);
  if (sshMatch) {
    const owner = sshMatch[1];
    const repo = sshMatch[2].replace(/\.git$/, "");
    return createRepoInfo(owner, repo);
  }

  const ownerRepoMatch = trimmed.match(OWNER_REPO_REGEX);
  if (ownerRepoMatch) {
    const owner = ownerRepoMatch[1];
    const repo = ownerRepoMatch[2];
    return createRepoInfo(owner, repo);
  }

  return null;
}

/**
 * Format a RepoInfo as owner/repo string.
 */
export function formatRepo(info: RepoInfo): string {
  return `${info.owner}/${info.repo}`;
}
