# opencode-ask-github

GitHub repository exploration plugin for OpenCode V2. Clones repositories on-demand and delegates analysis to AI subagents.

## Features

- **Auto-clone**: Repositories are cloned on-demand with shallow clone for speed
- **AI Analysis**: Delegates to the `explore` subagent for codebase analysis
- **Aliases**: Configure shortcuts for frequently used repositories
- **Cache Management**: List and remove cloned repositories

## Installation

Install the OpenCode V2 prerelease via npm/bun:

```bash
bun add opencode-ask-github@1.0.2-opencode-v2
# or
npm install opencode-ask-github@1.0.2-opencode-v2
```

Or add manually to your OpenCode configuration (`~/.config/opencode/config.json`):

```json
{
  "plugin": ["opencode-ask-github@1.0.2-opencode-v2"]
}
```

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

The plugin provides the repository tool plus two command-support tools required by OpenCode V2's prompt-based command API:

| Tool | Description |
| --------- | ----------------------------------------------------------------- |
| `gh-ask` | Prepare a GitHub repo for exploration (clone/update). Returns the local path and suggests a subagent for analysis. |
| `gh-list` | List cached repositories and configured aliases. |
| `gh-remove` | Remove a cached repository. |

The AI can call this tool directly when it needs to explore a repository, even without the `/gh-ask` command.

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
