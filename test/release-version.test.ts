import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import path from "node:path";

const script = path.join(import.meta.dir, "..", "scripts", "check-release.mjs");

function validate(version: string, requestedVersion = version) {
  return spawnSync(process.execPath, [script], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      OPENCODE_RELEASE_VERSION_TEST: version,
      REQUESTED_VERSION: requestedVersion,
    },
  });
}

describe("OpenCode V2 release version guard", () => {
  test.each([
    "0.0.0-opencode-v2",
    "1.2.3-opencode-v2",
    "10.20.30-opencode-v2",
  ])("accepts strict SemVer core version %s", (version) =>
    expect(validate(version).status).toBe(0));

  test.each([
    "01.2.3-opencode-v2",
    "1.02.3-opencode-v2",
    "1.2.03-opencode-v2",
    "1.2-opencode-v2",
    "1.2.3.4-opencode-v2",
    "1.2.3-alpha-opencode-v2",
    "1.2.3-opencode-v2-extra",
    "v1.2.3-opencode-v2",
    "1.2.3",
    " 1.2.3-opencode-v2",
  ])("rejects unsafe version %s", (version) => expect(validate(version).status).not.toBe(0));

  test("rejects a requested version that differs from the package version", () => {
    expect(validate("1.2.3-opencode-v2", "1.2.4-opencode-v2").status).not.toBe(0);
  });
});
