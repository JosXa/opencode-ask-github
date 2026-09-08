import { describe, expect, test } from "bun:test";
import { parseRepoInput } from "../src/repo-parser";

describe("parseRepoInput", () => {
  test.each([
    ["owner/repo", "owner", "repo"],
    ["https://github.com/Owner/Repo.git", "Owner", "Repo"],
    ["git@github.com:Owner/Repo.git", "Owner", "Repo"],
  ])("parses %s", (input, owner, repo) => {
    expect(parseRepoInput(input, {}).repoInfo).toMatchObject({ owner, repo });
  });

  test("resolves aliases case-insensitively", () => {
    const result = parseRepoInput("OC", { oc: "anomalyco/opencode" });
    expect(result.repoInfo).toMatchObject({ owner: "anomalyco", repo: "opencode" });
    expect(result.matchedAlias).toEqual({ alias: "oc", target: "anomalyco/opencode" });
  });

  test("only accepts a unique cached substring", () => {
    const repos = [
      { owner: "one", repo: "toolkit", path: "/one", lastModified: new Date(0) },
      { owner: "two", repo: "tools", path: "/two", lastModified: new Date(0) },
    ];
    expect(parseRepoInput("tool", {}, repos).repoInfo).toBeNull();
    expect(parseRepoInput("kit", {}, repos).repoInfo).toMatchObject({
      owner: "one",
      repo: "toolkit",
    });
  });
});
