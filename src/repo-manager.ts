import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { ensureCacheDir, getCacheDir } from "./config";
import type { ClonedRepo, RepoInfo } from "./types";

/**
 * Get the local path for a repository.
 */
export function getRepoPath(info: RepoInfo): string {
  return join(getCacheDir(), info.owner, info.repo);
}

/**
 * Check if a repository is already cloned.
 */
export function isCloned(info: RepoInfo): boolean {
  const path = getRepoPath(info);
  return existsSync(join(path, ".git"));
}

/**
 * Run a git command with stdout/stderr suppressed.
 * Returns { success, error } result object.
 */
async function runGitCommand(
  args: string[],
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  const proc = Bun.spawn(["git", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;

  return {
    success: exitCode === 0,
    stdout,
    stderr,
  };
}

/**
 * Clone a repository using shallow clone for speed.
 */
export async function cloneRepo(info: RepoInfo): Promise<{ success: boolean; error?: string }> {
  ensureCacheDir();

  const path = getRepoPath(info);
  const ownerDir = join(getCacheDir(), info.owner);

  // Ensure owner directory exists
  if (!existsSync(ownerDir)) {
    mkdirSync(ownerDir, { recursive: true });
  }

  const result = await runGitCommand(["clone", "--depth", "1", `${info.url}.git`, path]);

  if (!result.success) {
    return {
      success: false,
      error: result.stderr,
    };
  }

  return { success: true };
}

/**
 * Update an existing repository by fetching and resetting to the default branch.
 */
export async function updateRepo(info: RepoInfo): Promise<{ success: boolean; error?: string }> {
  const path = getRepoPath(info);

  // Fetch latest from origin
  const fetchResult = await runGitCommand(["-C", path, "fetch", "--depth", "1", "origin"]);

  if (!fetchResult.success) {
    return {
      success: false,
      error: fetchResult.stderr,
    };
  }

  // Get the default branch name from remote HEAD
  const defaultBranchResult = await runGitCommand([
    "-C",
    path,
    "symbolic-ref",
    "refs/remotes/origin/HEAD",
    "--short",
  ]);

  if (!defaultBranchResult.success) {
    // Fallback: try to reset to origin/main or origin/master
    const resetMain = await runGitCommand(["-C", path, "reset", "--hard", "origin/main"]);
    if (resetMain.success) {
      return { success: true };
    }

    const resetMaster = await runGitCommand(["-C", path, "reset", "--hard", "origin/master"]);
    if (resetMaster.success) {
      return { success: true };
    }

    return {
      success: false,
      error: "Could not determine default branch",
    };
  }

  // Reset to the default branch (e.g., "origin/main" -> reset to that)
  const defaultBranch = defaultBranchResult.stdout.trim();
  const resetResult = await runGitCommand(["-C", path, "reset", "--hard", defaultBranch]);

  if (!resetResult.success) {
    return {
      success: false,
      error: resetResult.stderr,
    };
  }

  return { success: true };
}

/**
 * Remove a cloned repository.
 */
export function removeRepo(info: RepoInfo): boolean {
  const path = getRepoPath(info);

  if (!existsSync(path)) {
    return false;
  }

  rmSync(path, { recursive: true, force: true });
  return true;
}

/**
 * List all cloned repositories.
 */
export function listClonedRepos(): ClonedRepo[] {
  const cacheDir = getCacheDir();
  const repos: ClonedRepo[] = [];

  if (!existsSync(cacheDir)) {
    return repos;
  }

  const owners = readdirSync(cacheDir);

  for (const owner of owners) {
    const ownerPath = join(cacheDir, owner);
    const stat = statSync(ownerPath);

    if (!stat.isDirectory()) continue;

    const repoNames = readdirSync(ownerPath);

    for (const repo of repoNames) {
      const repoPath = join(ownerPath, repo);
      const gitPath = join(repoPath, ".git");

      if (existsSync(gitPath)) {
        const repoStat = statSync(repoPath);
        repos.push({
          owner,
          repo,
          path: repoPath,
          lastModified: repoStat.mtime,
        });
      }
    }
  }

  return repos.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
}
