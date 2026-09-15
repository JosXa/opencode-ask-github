# opencode-ask-github

GitHub repository exploration plugin for OpenCode V2. Clones repositories on-demand and delegates analysis to AI subagents.

## Features

- **Auto-clone**: Repositories are cloned on-demand with shallow clone for speed
- **AI Analysis**: Delegates to the `explore` subagent for codebase analysis
- **Aliases**: Configure shortcuts for frequently used repositories
- **Cache Management**: List and remove cloned repositories

## Installation

This branch targets the native OpenCode V2 plugin API with `@opencode/plugin` 2.0.2 and Node.js 20 or later. Git must be on `PATH`, with SSH access to GitHub configured.

The SDK is a build dependency. The published package contains a Node ESM bundle with only a default plugin export and no runtime npm dependencies.

Build a local checkout:

```bash
bun install --frozen-lockfile
bun run build
```

Register its absolute `dist` directory in `opencode.json` inside your V2 config root (`OPENCODE_CONFIG_DIR`). Native V2 resolves local directories through `server` or `index`, so select `dist` to load the compiled JavaScript:

```json
{
  "plugins": ["/absolute/path/to/opencode-ask-github/dist"]
}
```

Releases from this branch keep the package name `opencode-ask-github`, use an `-opencode-v2` prerelease version, and publish to the `opencode-v2` npm channel. Register a published package as `opencode-ask-github@opencode-v2`, or pin an exact prerelease such as `opencode-ask-github@1.0.2-opencode-v2`. The git branch remains `v2`; publication requires a manual workflow run from that branch and an exact version match. CI checks both `opencode-v2` and `v2` git branches.

## Commands

### `/gh-ask <repo> [question]`

Clone/locate a repository and analyze it with AI.

```
/gh-ask sveltejs/svelte how is the component compiler structured?
/gh-ask https://github.com/tailwindlabs/tailwindcss what's the CLI architecture?
/gh-ask sv explain the reactivity system
```

The command nudges the AI to use the `gh-ask` tool, which prepares the repository locally. The AI then delegates to a subagent for exploration.

**Supported input formats:**

- GitHub URLs: `https://github.com/owner/repo`
- owner/repo pairs: `sveltejs/svelte`
- Aliases: `sv` (if configured)

### `/gh-list`

List all cloned repositories and configured aliases.

### `/gh-remove <repo>`

Remove a cloned repository from the cache.

## AI Tool

The plugin registers three tools in the native Code Mode catalog. Slash command callbacks submit prompts that ask the model to call these tools:

| Tool | Description |
| --------- | ----------------------------------------------------------------- |
| `gh-ask` | Prepare a GitHub repo for exploration (clone/update). Returns the local path and suggests a subagent for analysis. |
| `gh-list` | List cached repositories and configured aliases. |
| `gh-remove` | Remove a cached repository. |

The AI can call these tools through Code Mode without a slash command.

## Configuration

Configuration is stored in `~/.config/opencode/ask-github.json`.

### Aliases

Add aliases for frequently used repositories by editing the config file directly:

```json
{
  "aliases": {
    "sv": "sveltejs/svelte",
    "tw": "tailwindlabs/tailwindcss"
  }
}
```

You can also use `/gh-list` to see all configured aliases.

### Prompt

Customize which subagent is suggested for repository exploration:

```json
{
  "prompt": {
    "agent": "general"
  }
}
```

Default agent is `explore`.

## Storage

Repositories are cloned to `~/.cache/opencode-github/{owner}/{repo}/`.

## License

MIT
