import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "ask-github-v2-"));
  for (const dir of ["home", "config", "data", "cache", "state", "project", "bin"])
    await mkdir(join(root, dir));
  const env = {
    PATH: `${join(root, "bin")}:${process.env.PATH}`,
    HOME: join(root, "home"),
    XDG_CONFIG_HOME: join(root, "config"),
    XDG_DATA_HOME: join(root, "data"),
    XDG_CACHE_HOME: join(root, "cache"),
    XDG_STATE_HOME: join(root, "state"),
    OPENCODE_CONFIG_DIR: join(root, "config"),
    OPENCODE_DB: join(root, "test.db"),
    OPENCODE_PASSWORD: "ask-github-fixture",
    ASK_GITHUB_FIXTURE: root,
  };
  // No real git invocation or network access is possible from repository operations.
  await writeFile(
    join(root, "bin", "git"),
    `#!${process.execPath}
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
const args = process.argv.slice(2);
const root = process.env.ASK_GITHUB_FIXTURE;
appendFileSync(root + "/git.jsonl", JSON.stringify(args) + "\\n");
const mode = existsSync(root + "/git-mode") ? readFileSync(root + "/git-mode", "utf8") : "";
if (mode === "fail" || (mode === "fallback" && args.includes("symbolic-ref"))) {
  process.stderr.write("fixture git failure"); process.exit(1);
}
if (args[0] === "clone") mkdirSync(args.at(-1) + "/.git", { recursive: true });
if (args.includes("symbolic-ref")) process.stdout.write("origin/main\\n");
`,
    { mode: 0o755 },
  );
  // The extensionless executable is ESM even on Node 20.
  await writeFile(join(root, "bin", "package.json"), '{"type":"module"}');
  await mkdir(join(env.HOME, ".config", "opencode"), { recursive: true });
  await writeFile(
    join(env.HOME, ".config", "opencode", "ask-github.json"),
    JSON.stringify({ aliases: { fixture: "fixture/repo" }, prompt: { agent: "explore" } }),
  );
  return { root, env, cwd: join(root, "project") };
}
