#!/usr/bin/env bun

/**
 * Integration test: Actually clone a small repo and verify the flow
 * Tests the REAL cloning functionality, not mocked
 */

import { $ } from "bun";
import { cloneRepo, getRepoPath, isCloned, listClonedRepos } from "./src/repo-manager";
import type { RepoInfo } from "./src/types";

async function integrationTest() {
  console.log("🧪 Integration Test: Real Repository Cloning\n");
  console.log("━".repeat(60));

  // Test repo: choose a small, fast repo
  const testRepo: RepoInfo = {
    owner: "sst",
    repo: "opencode",
    url: "https://github.com/sst/opencode",
  };

  console.log("\n📋 Phase 1: Check initial state");
  const localPath = getRepoPath(testRepo);
  const initiallyCloned = isCloned(testRepo);
  console.log(`Repository: ${testRepo.owner}/${testRepo.repo}`);
  console.log(`Local path: ${localPath}`);
  console.log(`Initially cloned: ${initiallyCloned}`);

  if (initiallyCloned) {
    console.log("⚠️  Repo already cloned, removing for clean test...");
    await $`rm -rf ${localPath}`.nothrow();
  }

  console.log(`\n${"━".repeat(60)}`);
  console.log("\n📋 Phase 2: Clone the repository");
  console.log("This will take 10-30 seconds for a shallow clone...\n");

  try {
    await cloneRepo(testRepo, $);
    console.log("✅ Clone completed successfully");
  } catch (error) {
    console.error("❌ Clone failed:", error);
    process.exit(1);
  }

  console.log(`\n${"━".repeat(60)}`);
  console.log("\n📋 Phase 3: Verify clone");

  const afterClone = isCloned(testRepo);
  console.log(`Repository: ${testRepo.owner}/${testRepo.repo}`);
  console.log(`Local path: ${localPath}`);
  console.log(`Is cloned: ${afterClone}`);

  if (!afterClone) {
    console.error("❌ Repository not detected as cloned after clone operation");
    process.exit(1);
  }

  // Verify it's actually a git repo
  try {
    const result = await $`git -C ${localPath} rev-parse --git-dir`.nothrow();
    if (result.exitCode === 0) {
      console.log("✅ Verified as valid git repository");
    } else {
      console.error("❌ Not a valid git repository");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Failed to verify git repository:", error);
    process.exit(1);
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
    console.error("❌ Cloned repo not found in list");
    process.exit(1);
  }
  console.log("✅ Cloned repo appears in list");

  console.log(`\n${"━".repeat(60)}`);
  console.log("\n🎉 All integration tests passed!\n");
  console.log("Summary:");
  console.log("- ✅ Repository cloning works correctly");
  console.log("- ✅ Clone detection works after clone");
  console.log("- ✅ Cloned repository is valid git repo");
  console.log("- ✅ Repository listing works correctly");
  console.log("\n📦 Cloned repository available at:");
  console.log(`   ${localPath}`);
  console.log("\n💡 You can now test /github-ask in an interactive TUI session!");
}

integrationTest();
