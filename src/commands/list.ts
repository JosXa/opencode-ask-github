import type { ClonedRepo, Config } from "../types.js";

export function renderRepoList(config: Config, repos: ClonedRepo[], now = Date.now()): string {
  const lines: string[] = ["**Cloned repositories:**"];
  if (repos.length === 0) {
    lines.push("_No repositories cloned yet_");
  } else {
    for (const repo of repos) {
      lines.push(`- \`${repo.owner}/${repo.repo}\` (${formatAge(repo.lastModified, now)})`);
    }
  }

  lines.push("", "**Configured aliases:**");
  const aliases = Object.entries(config.aliases);
  if (aliases.length === 0) {
    lines.push("_No aliases configured_");
  } else {
    for (const [alias, target] of aliases) lines.push(`- \`${alias}\` → \`${target}\``);
  }
  return lines.join("\n");
}

function formatAge(date: Date, now: number): string {
  const minutes = Math.floor((now - date.getTime()) / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} min${minutes > 1 ? "s" : ""} ago`;
  return "just now";
}
