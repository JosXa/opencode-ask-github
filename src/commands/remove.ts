import { loadConfig } from "../config.js";
import { sendIgnoredMessage } from "../notification.js";
import { isCloned, listClonedRepos, removeRepo } from "../repo-manager.js";
import { formatRepo, parseRepoInput } from "../repo-parser.js";
import type { CommandContext } from "../types.js";

/**
 * Handle /github-remove command.
 * Remove a cloned repository from the cache.
 */
export async function handleRemove(args: string, ctx: CommandContext): Promise<void> {
  const config = loadConfig();

  const repoInput = args.trim();

  if (!repoInput) {
    await sendIgnoredMessage(ctx, "Usage: `/gh-remove <repo>`");
    return;
  }

  const clonedRepos = listClonedRepos();
  const result = parseRepoInput(repoInput, config.aliases, clonedRepos);

  if (!result.repoInfo) {
    await sendIgnoredMessage(ctx, `Could not parse repository: \`${repoInput}\``);
    return;
  }

  const repoInfo = result.repoInfo;
  const repoDisplay = formatRepo(repoInfo);

  if (!isCloned(repoInfo)) {
    await sendIgnoredMessage(ctx, `Repository \`${repoDisplay}\` is not cloned.`);
    return;
  }

  const removed = removeRepo(repoInfo);

  const message = removed
    ? `Removed \`${repoDisplay}\` from cache.`
    : `Failed to remove \`${repoDisplay}\`.`;

  await sendIgnoredMessage(ctx, message);
}
