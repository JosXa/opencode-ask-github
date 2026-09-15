import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));

describe("V2 npm channel and git release source", () => {
  test("keeps the npm channel distinct from the literal git branch", () => {
    expect(manifest.publishConfig.tag).toBe("opencode-v2");
    const workflow = Bun.YAML.parse(
      readFileSync(new URL(".github/workflows/publish.yml", root), "utf8"),
    ) as {
      on: { push: { branches: string[] } };
      jobs: { publish: { if: string; steps: { run?: string }[] } };
    };
    expect(workflow.on.push.branches).toEqual(["opencode-v2", "v2"]);
    expect(workflow.jobs.publish.if).toBe(
      "github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/v2'",
    );
    const commands = workflow.jobs.publish.steps.flatMap((step) => step.run ?? []);
    expect(commands).toContain("npm publish --provenance --access public --tag opencode-v2");
    expect(
      commands.some((command) => command.includes('test "$GITHUB_REF" = "refs/heads/v2"')),
    ).toBe(true);
  });

  test.each(["v2", "latest", "next"])("release guard rejects npm channel %s", (tag) => {
    const directory = mkdtempSync(join(tmpdir(), "ask-github-channel-"));
    try {
      mkdirSync(join(directory, "scripts"));
      writeFileSync(
        join(directory, "scripts/check-release.mjs"),
        readFileSync(new URL("scripts/check-release.mjs", root)),
      );
      writeFileSync(
        join(directory, "package.json"),
        JSON.stringify({ ...manifest, publishConfig: { tag } }),
      );
      const result = spawnSync(process.execPath, [join(directory, "scripts/check-release.mjs")], {
        encoding: "utf8",
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("must use the opencode-v2 npm tag");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
