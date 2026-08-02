import { describe, expect, test } from "bun:test";
import { formatRepo, parseRepoInput } from "./repo-parser.js";
import type { AliasMap, ClonedRepo } from "./types.js";

const aliases: AliasMap = {
  oc: "sst/opencode",
};

describe("parseRepoInput", () => {
  test.each([
    "sst/opencode",
    "https://github.com/sst/opencode",
    "https://github.com/sst/opencode.git",
    "git@github.com:sst/opencode.git",
  ])("normalizes %s", (input) => {
    expect(parseRepoInput(input, {}).repoInfo).toEqual({
      owner: "sst",
      repo: "opencode",
      url: "https://github.com/sst/opencode",
      cloneUrl: "git@github.com:sst/opencode.git",
    });
  });

  test("resolves aliases case-insensitively", () => {
    const result = parseRepoInput("OC", aliases);

    expect(result.repoInfo && formatRepo(result.repoInfo)).toBe("sst/opencode");
    expect(result.matchedAlias).toEqual({ alias: "oc", target: "sst/opencode" });
  });

  test("resolves one cloned repository by substring", () => {
    const clonedRepos: ClonedRepo[] = [
      {
        owner: "oven-sh",
        repo: "bun",
        path: "/cache/oven-sh/bun",
        lastModified: new Date(0),
      },
    ];

    const result = parseRepoInput("bu", {}, clonedRepos);

    expect(result.repoInfo && formatRepo(result.repoInfo)).toBe("oven-sh/bun");
    expect(result.matchedClonedRepo).toBe(clonedRepos[0]);
  });

  test("rejects ambiguous substring matches", () => {
    const clonedRepos: ClonedRepo[] = ["one", "two"].map((owner) => ({
      owner,
      repo: "shared-repo",
      path: `/cache/${owner}/shared-repo`,
      lastModified: new Date(0),
    }));

    expect(parseRepoInput("shared", {}, clonedRepos)).toEqual({ repoInfo: null });
  });

  test("rejects malformed explicit owner/repo input", () => {
    expect(parseRepoInput("owner/repo/extra", aliases)).toEqual({ repoInfo: null });
  });
});
