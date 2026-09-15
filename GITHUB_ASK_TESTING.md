# AskGitHub V2 testing

## Build and unit tests

Install dependencies with the configured npm registry, then run:

```sh
bun install --frozen-lockfile
bun run check
```

The check includes lockfile portability, Biome, TypeScript, unit tests, a Node ESM bundle, and execution of the compiled plugin under Node. `scripts/test-node.mjs` tests clone, update, reset fallback, error output, list, removal, command arguments, and disposal using a fake Git executable. It creates a temporary HOME so repository operations cannot reach the user's cache.

After dependency changes, run `bun run lock:normalize` to clear registry resolution URLs while retaining versions and integrity hashes. `bun run test:lockfile` tests a frozen install with a fresh cache and asserts that requests use the configured npm registry. It does not change registry configuration.

Run the artifact test with Node 20 to verify the minimum supported Node major:

```sh
node scripts/test-node.mjs
```

Run `bun run test:build-path` with Node 20 on PATH to copy the actual source into a directory containing spaces and Unicode, build there, and test its tarball with npm engine-strict enabled.

## Native runtime

Use a native OpenCode V2 binary whose `--version` matches the SDK version in `package.json`. Check `--help` and `run --help` before changing test flags.

```sh
node scripts/test-native.mjs /path/to/opencode.exe /path/to/plugin
```

The script loads the plugin's `dist` directory and asserts the resolved entrypoint. Each run creates private HOME, XDG directories, config, and databases. A local HTTP provider emits deterministic tool calls, and fake Git records subprocess arguments. No provider credentials or real repositories are required.

The native test exercises `run --standalone` with a Code Mode sequence that clones, updates, lists, removes, and lists again. A separate private server executes `/gh-ask`, `/gh-list`, and `/gh-remove` through the session command API. The script checks the resulting provider input and tool output, writes evidence to its temporary directory, and stops its servers.

To test native npm installation from the `opencode-v2` channel, append `--npm-spec`. Use `--npm-spec=opencode-ask-github@1.0.2-opencode-v2` to test an exact version. A local fixture registry serves the packed artifact while the native runtime resolves the spec, downloads it, and loads its exported entrypoint. The test asserts package activation and compares the loaded file in the private cache with the build. Registry overrides apply only to the test process and its private HOME.

The combination `--npm-spec=opencode-ask-github@v2 --expect-v2-resolution-failure` retains a regression check for the invalid historical selector. It asserts rejection before download because npm interprets `v2` as a stable 2.x range. Use `opencode-v2` for the npm channel.

## Installed package

With Node 20 on PATH, run `bun run test:package`. This packs the bundle, installs it into an empty temporary directory using npm with `--engine-strict=true`, asserts that the installed graph contains only AskGitHub, and runs its Node tests. CI also runs this check against both native runtime versions; pass a runtime binary as an argument to `scripts/test-package.mjs` to repeat that locally.

Pack the plugin, then install the tarball into an empty directory outside the checkout:

```sh
npm pack --pack-destination /path/to/empty-directory
npm install --prefix /path/to/empty-directory --engine-strict=true --ignore-scripts --no-audit --no-fund /path/to/package.tgz
node scripts/test-node.mjs /path/to/empty-directory/node_modules/opencode-ask-github/dist/index.js
node scripts/test-native.mjs /path/to/opencode.exe /path/to/empty-directory/node_modules/opencode-ask-github
```

Use Node 20 for the installed artifact test. The native test must report a resolved entrypoint inside the installed package, which proves it did not load checkout source through a link.

These tests cover native tools and command dispatch. A real provider's choice to follow a command prompt and interactive TUI presentation require separate testing.
