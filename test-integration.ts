#!/usr/bin/env bun

/**
 * Integration test: Actually clone a small repo and verify the flow
 * Tests the REAL cloning functionality, not mocked
 */

import { $ } from "bun";
import {
  cloneRepo,
  getRepoPath,
  isCloned,
  listClonedRepos,
  removeRepo,
} from "./src/repo-manager.js";
import type { RepoInfo } from "./src/types.js";

async function integrationTest() {
  console.log("🧪 Integration Test: Real Repository Cloning\n");
  console.log("━".repeat(60));

  // Test repo: choose a small, fast repo
  const testRepo: RepoInfo = {
    owner: "octocat",
    repo: "Hello-World",
    url: "https://github.com/octocat/Hello-World",
    cloneUrl: "git@github.com:octocat/Hello-World.git",
  };

  console.log("\n📋 Phase 1: Check initial state");
  const localPath = getRepoPath(testRepo);
  const initiallyCloned = isCloned(testRepo);
  console.log(`Repository: ${testRepo.owner}/${testRepo.repo}`);
  console.log(`Local path: ${localPath}`);
  console.log(`Initially cloned: ${initiallyCloned}`);

  if (initiallyCloned) {
    throw new Error(`Refusing to remove pre-existing test repository at ${localPath}`);
  }

  try {
    console.log(`\n${"━".repeat(60)}`);
    console.log("\n📋 Phase 2: Clone the repository");
    console.log("This will take a few seconds for a shallow clone...\n");

    const cloneResult = await cloneRepo(testRepo);
    if (!cloneResult.success) {
      throw new Error(`Clone failed: ${cloneResult.error}`);
    }
    console.log("✅ Clone completed successfully");

    console.log(`\n${"━".repeat(60)}`);
    console.log("\n📋 Phase 3: Verify clone");

    const afterClone = isCloned(testRepo);
    console.log(`Repository: ${testRepo.owner}/${testRepo.repo}`);
    console.log(`Local path: ${localPath}`);
    console.log(`Is cloned: ${afterClone}`);

    if (!afterClone) {
      throw new Error("Repository not detected as cloned after clone operation");
    }

    // Verify it's actually a git repo
    try {
      const result = await $`git -C ${localPath} rev-parse --git-dir`.nothrow();
      if (result.exitCode === 0) {
        console.log("✅ Verified as valid git repository");
      } else {
        throw new Error("Not a valid git repository");
      }
    } catch (error) {
      throw new Error("Failed to verify git repository", { cause: error });
    }

    // Check if README exists (most repos have one)
    try {
      const result = await $`test -f ${localPath}/README.md`.nothrow();
      if (result.exitCode === 0) {
        console.log("✅ Found README.md in cloned repo");
      }
    } catch {
      console.log("ℹ️  No README.md found (not critical)");
    }

    console.log(`\n${"━".repeat(60)}`);
    console.log("\n📋 Phase 4: List all cloned repos");

    const allRepos = listClonedRepos();
    console.log(`Found ${allRepos.length} cloned repository/repositories:`);
    for (const repo of allRepos) {
      console.log(`  - ${repo.owner}/${repo.repo} at ${repo.path}`);
    }

    if (!allRepos.some((r) => r.owner === testRepo.owner && r.repo === testRepo.repo)) {
      throw new Error("Cloned repo not found in list");
    }
    console.log("✅ Cloned repo appears in list");

    console.log(`\n${"━".repeat(60)}`);
    console.log("\n🎉 All integration tests passed!\n");
    console.log("Summary:");
    console.log("- ✅ Repository cloning works correctly");
    console.log("- ✅ Clone detection works after clone");
    console.log("- ✅ Cloned repository is valid git repo");
    console.log("- ✅ Repository listing works correctly");
  } finally {
    if (removeRepo(testRepo)) {
      console.log(`\n🧹 Removed integration-test clone at ${localPath}`);
    }
  }
}

await integrationTest();
