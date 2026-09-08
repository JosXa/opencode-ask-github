import type { AliasMap } from "../types.js";

function formatAliases(aliases: AliasMap): string {
  const entries = Object.entries(aliases);
  if (entries.length === 0) return "_No aliases configured_";
  return entries.map(([alias, repo]) => `- \`${alias}\` → \`${repo}\``).join("\n");
}

export function renderAskUsage(aliases: AliasMap): string {
  return `Usage: /gh-ask <repo> [question]

**repo** can be:
- GitHub URL: \`https://github.com/owner/repo\`
- owner/repo: \`sveltejs/svelte\`
- alias: \`sv\` (if configured)

**Configured aliases:**
${formatAliases(aliases)}`;
}

export function renderUnresolvedRepo(repo: string, aliases: AliasMap): string {
  const entries = Object.entries(aliases);
  const aliasHint =
    entries.length > 0
      ? `\nConfigured aliases: ${entries.map(([alias, target]) => `${alias}=${target}`).join(", ")}`
      : "";
  return `Could not resolve repository: ${repo}${aliasHint}`;
}
