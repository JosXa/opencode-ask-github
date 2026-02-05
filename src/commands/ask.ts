import { getPromptConfig, loadConfig } from "../config";
import { showToast } from "../notification";
import {
  cloneRepo,
  getRepoPath,
  isCloned,
  listClonedRepos,
  updateRepo,
} from "../repo-manager";
import { formatRepo, parseRepoInput } from "../repo-parser";
import type { CommandContext } from "../types";

/**
 * Handle /github-ask command.
 * Clone repo if needed, then delegate to explore subagent.
 */
export async function handleAsk(
  args: string,
  ctx: CommandContext,
): Promise<void> {
  const { client, directory, sessionId } = ctx;
  const config = loadConfig();

  // Parse args: first token is repo, rest is question
  const tokens = args.trim().split(/\s+/);
  const repoInput = tokens[0];
  const question =
    tokens.slice(1).join(" ") || "provide an overview of this repository";

  if (!repoInput) {
    await injectMessage(
      client,
      sessionId,
      directory,
      `Usage: /github-ask <repo> [question]

**repo** can be:
- GitHub URL: \`https://github.com/owner/repo\`
- owner/repo: \`sveltejs/svelte\`
- alias: \`sv\` (if configured)

**Configured aliases:**
${formatAliases(config.aliases)}`,
    );
    return;
  }

  // Parse the repo input (with cloned repos for substring matching)
  const clonedRepos = listClonedRepos();
  const parseResult = parseRepoInput(repoInput, config.aliases, clonedRepos);

  if (!parseResult.repoInfo) {
    const errorMsg = `Could not parse repository: \`${repoInput}\`

Expected formats:
- \`https://github.com/owner/repo\`
- \`owner/repo\`
- Configured alias
- Substring of a cloned repo name

**Configured aliases:**
${formatAliases(config.aliases)}

_Tip: You can add an alias for quick access using the github-alias-add tool._`;

    await injectMessage(client, sessionId, directory, errorMsg);
    return;
  }

  const repoInfo = parseResult.repoInfo;
  const repoDisplay = formatRepo(repoInfo);
  const localPath = getRepoPath(repoInfo);
  const alreadyCloned = isCloned(repoInfo);

  // Prepare the repo (clone or update)
  if (!alreadyCloned) {
    // Clone flow
    await injectMessage(
      client,
      sessionId,
      directory,
      `Preparing ${repoDisplay}...`,
      true,
    );

    await showToast(ctx, {
      message: `Cloning ${repoDisplay}...`,
      variant: "info",
    });
    const result = await cloneRepo(repoInfo);

    if (!result.success) {
      await showToast(ctx, {
        title: "Clone failed",
        message: result.error ?? "Unknown error",
        variant: "error",
      });
      await injectMessage(
        client,
        sessionId,
        directory,
        `Failed to clone ${repoDisplay}:\n\`\`\`\n${result.error}\n\`\`\``,
      );
      return;
    }

    await showToast(ctx, {
      title: "Cloned",
      message: repoDisplay,
      variant: "success",
      duration: 3000,
    });
  } else {
    // Update flow
    await injectMessage(
      client,
      sessionId,
      directory,
      `Preparing ${repoDisplay}...`,
      true,
    );

    await showToast(ctx, {
      message: `Updating ${repoDisplay}...`,
      variant: "info",
    });
    const result = await updateRepo(repoInfo);

    if (!result.success) {
      await showToast(ctx, {
        title: "Update failed",
        message: result.error ?? "Unknown error",
        variant: "error",
      });
      await injectMessage(
        client,
        sessionId,
        directory,
        `Failed to update ${repoDisplay}:\n\`\`\`\n${result.error}\n\`\`\``,
      );
      return;
    }

    await showToast(ctx, {
      title: "Updated",
      message: repoDisplay,
      variant: "success",
      duration: 3000,
    });
  }

  // Delegate to explore subagent
  const promptConfig = getPromptConfig(config);
  const instruction = promptConfig.delegateInstruction.replace(
    "{path}",
    localPath,
  );
  const explorePrompt = promptConfig.exploreTemplate.replace(
    "{question}",
    question,
  );

  await client.session.prompt({
    path: { id: sessionId },
    body: {
      parts: [
        {
          type: "text",
          text: `${instruction}
---
${explorePrompt}
---`,
        },
      ],
    },
    query: { directory },
  });
}

function formatAliases(aliases: Record<string, string>): string {
  const entries = Object.entries(aliases);
  if (entries.length === 0) {
    return "_No aliases configured_";
  }
  return entries
    .map(([alias, repo]) => `- \`${alias}\` → \`${repo}\``)
    .join("\n");
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
