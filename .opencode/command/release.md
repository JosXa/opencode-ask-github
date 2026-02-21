# Release Command

Guide through a complete release workflow for opencode-ask-github.

## Usage

`/release` - Analyze commits and bump version (patch/minor/major based on conventional commits)

## Instructions

You are guiding the user through the complete release workflow. Follow these steps EXACTLY:

### Pre-Release Checklist

1. **Verify working directory is clean:**
   - Run `git status` to check for uncommitted changes
   - If there are uncommitted changes, STOP and ask user to commit or discard them first

2. **Verify CI is passing:**
   - Run `gh run list --limit 3`
   - If latest run is not successful, STOP and ask user to fix CI first

### Release Steps

Execute these steps IN ORDER:

**Step 1: Determine Version Bump**

- Read current version from `package.json`
- Get commits since last tag:
  - `git describe --tags --abbrev=0` (get last tag)
  - `git log $(git describe --tags --abbrev=0)..HEAD --oneline` (commits since)
- Analyze commit messages using conventional commits:
  - **MAJOR** (X.0.0): Any commit with `BREAKING CHANGE:` in body OR `!` after type (e.g., `feat!:`, `fix!:`)
  - **MINOR** (X.Y.0): Any commit starting with `feat:` or `feat(scope):`
  - **PATCH** (X.Y.Z): Everything else (`fix:`, `chore:`, `docs:`, `refactor:`, etc.)
- Use the HIGHEST bump level found (major > minor > patch)
- If MAJOR version bump detected: STOP and ask user for confirmation before proceeding. Explain which commit(s) triggered the major bump.
- Calculate new version and inform user:
  - Example: `Bumping version: 0.1.5 -> 0.1.6 (patch - fixes/chore only)`

Then:

- Use the Edit tool to update `package.json` with the new version
- Run repo checks (this repo uses Bun):
  - `bun run format:fix`
  - `bun run typecheck`
  - `bun run build`
- Commit version bump:
  - `git add package.json`
  - `git commit -m "chore: bump version to vX.Y.Z"`

**Step 2: Push Version Bump**

- Push to remote: `git push`
- Wait for CI to pass: `gh run list --limit 3`
- If CI fails, STOP and inform user (see Recovery section)

**Step 3: Create and Push Tag**

- Create git tag: `git tag vX.Y.Z`
- Push tag: `git push origin vX.Y.Z`
- Inform user that CI will now run publish workflow (if configured)

**Step 4: Create GitHub Release**

- Release notes are GENERATED automatically.
- Run:
  - `gh release create vX.Y.Z --title "vX.Y.Z" --generate-notes`

**Step 5: Monitor and Verify**

- Check recent workflows: `gh run list --limit 5`
- Wait for any publish workflow to complete (if present)
- Open release page:
  - `start https://github.com/JosXa/opencode-ask-github/releases/tag/vX.Y.Z`
- Inform user release is complete

### Recovery: Tag Pushed While CI Failing

If CI was failing when tag was pushed, MUST delete tag immediately:

```bash
git tag -d vX.Y.Z
git push origin :refs/tags/vX.Y.Z
```

Then:

1. Fix CI issues
2. Restart release process from Step 2

### Important Notes

- Version format: X.Y.Z (no 'v' prefix in `package.json`, but 'v' prefix in git tags)
- Use Bun only (`bun run ...`), never npm/yarn/pnpm
- This repo MUST be rebuilt via `bun run build` for changes to take effect
- Repository: https://github.com/JosXa/opencode-ask-github

### Error Handling

If ANY step fails:

1. STOP the workflow
2. Inform user of the failure
3. Provide recovery instructions
4. DO NOT proceed to next steps

CRITICAL: If tag is pushed but CI fails, recovery steps are MANDATORY.
