import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import path from "node:path";

const script = path.join(import.meta.dir, "..", "scripts", "check-release.mjs");

function validate(version: string, requestedVersion = `v${version}`) {
  return spawnSync(process.execPath, [script], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      OPENCODE_RELEASE_VERSION_TEST: version,
      REQUESTED_VERSION: requestedVersion,
    },
  });
}

describe("release version guard", () => {
  test.each([
    "0.0.0",
    "1.2.3",
    "2.0.0",
    "10.20.30",
  ])("accepts stable SemVer version %s", (version) => expect(validate(version).status).toBe(0));

  test.each([
    "01.2.3",
    "1.02.3",
    "1.2.03",
    "1.2",
    "1.2.3.4",
    "1.2.3-alpha",
    "1.2.3-opencode-v2",
    "v1.2.3",
    " 1.2.3",
  ])("rejects unsafe version %s", (version) => expect(validate(version).status).not.toBe(0));

  test("rejects a release tag that differs from the package version", () => {
    expect(validate("1.2.3", "v1.2.4").status).not.toBe(0);
  });

  test("rejects a release tag without the v prefix", () => {
    expect(validate("1.2.3", "1.2.3").status).not.toBe(0);
  });
});
