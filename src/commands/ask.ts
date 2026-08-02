import { loadConfig } from "../config.js";
import { listClonedRepos } from "../repo-manager.js";
import { formatRepo, parseRepoInput } from "../repo-parser.js";
import type { CommandContext } from "../types.js";

/**
 * Handle /gh-ask command.
 * Injects a message nudging the LLM to use the gh-ask tool.
 */
export async function handleAsk(args: string, ctx: CommandContext): Promise<void> {
  const { client, directory, sessionId } = ctx;
  const config = loadConfig();

  // Parse args: first token is repo, rest is question
  const tokens = args.trim().split(/\s+/);
  const repoInput = tokens[0];
  const question = tokens.slice(1).join(" ");

  if (!repoInput) {
    await injectMessage(
      client,
      sessionId,
      directory,
      `Usage: /gh-ask <repo> [question]

**repo** can be:
- GitHub URL: \`https://github.com/owner/repo\`
- owner/repo: \`sveltejs/svelte\`
- alias: \`sv\` (if configured)

**Configured aliases:**
${formatAliases(config.aliases)}`,
    );
    return;
  }

  // Resolve the repo so we can show a clean name in the nudge
  const clonedRepos = listClonedRepos();
  const parseResult = parseRepoInput(repoInput, config.aliases, clonedRepos);

  if (!parseResult.repoInfo) {
    await injectMessage(
      client,
      sessionId,
      directory,
      `Could not parse repository: \`${repoInput}\`

Expected formats:
- \`https://github.com/owner/repo\`
- \`owner/repo\`
- Configured alias
- Substring of a cloned repo name

**Configured aliases:**
${formatAliases(config.aliases)}`,
    );
    return;
  }

  const repoDisplay = formatRepo(parseResult.repoInfo);

  // Nudge the LLM to use the gh-ask tool
  const nudge = question
    ? `Please use the gh-ask tool on repository \`${repoDisplay}\` to answer:\n${question}`
    : `Please use the gh-ask tool to prepare repository \`${repoDisplay}\` for exploration.`;

  await injectMessage(client, sessionId, directory, nudge);
}

function formatAliases(aliases: Record<string, string>): string {
  const entries = Object.entries(aliases);
  if (entries.length === 0) {
    return "_No aliases configured_";
  }
  return entries.map(([alias, repo]) => `- \`${alias}\` → \`${repo}\``).join("\n");
}

async function injectMessage(
  client: CommandContext["client"],
  sessionId: string,
  directory: string,
  text: string,
  noReply = false,
): Promise<void> {
  await client.session.prompt({
    path: { id: sessionId },
    body: {
      noReply,
      parts: [{ type: "text", text }],
    },
    query: { directory },
  });
}
