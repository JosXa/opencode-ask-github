import { loadConfig } from "../config.js";
import { sendIgnoredMessage } from "../notification.js";
import { listClonedRepos } from "../repo-manager.js";
import type { CommandContext } from "../types.js";

/**
 * Handle /github-list command.
 * List all cloned repos and configured aliases.
 */
export async function handleList(ctx: CommandContext): Promise<void> {
  const config = loadConfig();
  const repos = listClonedRepos();

  const lines: string[] = ["**Cloned repositories:**"];

  if (repos.length === 0) {
    lines.push("_No repositories cloned yet_");
  } else {
    for (const repo of repos) {
      const age = formatAge(repo.lastModified);
      lines.push(`- \`${repo.owner}/${repo.repo}\` (${age})`);
    }
  }

  lines.push("");
  lines.push("**Configured aliases:**");

  const aliases = Object.entries(config.aliases);
  if (aliases.length === 0) {
    lines.push("_No aliases configured_");
  } else {
    for (const [alias, target] of aliases) {
      lines.push(`- \`${alias}\` → \`${target}\``);
    }
  }

  await sendIgnoredMessage(ctx, lines.join("\n"));
}

function formatAge(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} min${minutes > 1 ? "s" : ""} ago`;
  return "just now";
}
