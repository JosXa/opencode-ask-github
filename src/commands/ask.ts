import { getPromptConfig, loadConfig } from "../config.js";
import { cloneRepo, getRepoPath, isCloned, listClonedRepos, updateRepo } from "../repo-manager.js";
import { formatRepo, parseRepoInput } from "../repo-parser.js";

/** Prepare the repository before the model receives the tool result and question. */
export async function handleAsk(args: string): Promise<string> {
  const match = args.trim().match(/^(\S+)(?:\s+([\s\S]*))?$/);
  const repo = match?.[1] ?? "";
  const question = match?.[2] ?? "";
  const result = await prepareRepository(repo);
  return question ? `${result}\n\n${question}` : result;
}

export async function prepareRepository(repo: string): Promise<string> {
  const config = loadConfig();
  if (repo.trim() === "") {
    const aliases = Object.entries(config.aliases);
    return `Usage: /gh-ask <repo> [question]

**repo** can be:
- GitHub URL: \`https://github.com/owner/repo\`
- owner/repo: \`sveltejs/svelte\`
- alias: \`sv\` (if configured)

**Configured aliases:**
${aliases.length ? aliases.map(([alias, target]) => `- \`${alias}\` → \`${target}\``).join("\n") : "_No aliases configured_"}`;
  }

  const result = parseRepoInput(repo, config.aliases, listClonedRepos());
  if (!result.repoInfo) {
    const aliases = Object.entries(config.aliases);
    const aliasHint = aliases.length
      ? `\nConfigured aliases: ${aliases.map(([alias, target]) => `${alias}=${target}`).join(", ")}`
      : "";
    return `Could not resolve repository: ${repo}${aliasHint}`;
  }

  const info = result.repoInfo;
  const display = formatRepo(info);
  const localPath = getRepoPath(info);
  const wasCloned = isCloned(info);
  const operation = wasCloned ? await updateRepo(info) : await cloneRepo(info);
  if (!operation.success) {
    return `Failed to ${wasCloned ? "update" : "clone"} ${display}: ${operation.error}`;
  }

  return `${display} is ready at ${localPath}.\nUse the @${getPromptConfig(config).agent} subagent to answer questions about this codebase.`;
}
