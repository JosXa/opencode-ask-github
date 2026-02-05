# opencode-ask-github

GitHub repository management plugin for OpenCode. Automatically clones repositories and delegates analysis to AI subagents.

## Features

- **Auto-clone**: Repositories are cloned on-demand with shallow clone for speed
- **AI Analysis**: Delegates to the `explore` subagent for codebase analysis
- **Aliases**: Configure shortcuts for frequently used repositories
- **Cache Management**: List and remove cloned repositories

## Installation

Install via npm/bun:

```bash
bunx opencode-ask-github
# or
npx opencode-ask-github
```

Or add manually to your OpenCode configuration (`~/.config/opencode/config.json`):

```json
{
  "plugins": ["opencode-ask-github"]
}
```

## Commands

### `/github-ask <repo> [question]`

Clone/locate a repository and analyze it with AI.

```
/github-ask sveltejs/svelte how is the component compiler structured?
/github-ask https://github.com/tailwindlabs/tailwindcss what's the CLI architecture?
/github-ask sv explain the reactivity system
```

**Supported input formats:**

- GitHub URLs: `https://github.com/owner/repo`
- owner/repo pairs: `sveltejs/svelte`
- Aliases: `sv` (if configured)

### `/github-list`

List all cloned repositories and configured aliases.

### `/github-remove <repo>`

Remove a cloned repository from the cache.

## Configuration

Aliases are stored in `~/.config/opencode/ask-github.json`:

```json
{
  "aliases": {
    "sv": "sveltejs/svelte",
    "tw": "tailwindlabs/tailwindcss"
  }
}
```

You can also manage aliases by asking the AI:

- "Add a GitHub alias 'react' for facebook/react"
- "List my GitHub aliases"
- "Remove the 'sv' alias"

## Storage

Repositories are cloned to `~/.cache/opencode-github/{owner}/{repo}/`.

## AI Tools

The plugin provides these tools for the AI to use:

| Tool                  | Description                 |
| --------------------- | --------------------------- |
| `github-alias-add`    | Add a repository alias      |
| `github-alias-remove` | Remove an alias             |
| `github-alias-list`   | List all aliases            |
| `github-repo-info`    | Get info about a repository |

## License

MIT
