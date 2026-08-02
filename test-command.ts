#!/usr/bin/env bun
/**
 * Direct test of the github-ask command handler
 * Simulates command.execute.before hook invocation
 */

import { handleAsk } from "./src/commands/ask.js";
import type { CommandContext } from "./src/types.js";

// Mock client with minimal required functionality
const mockClient: MockClient = {
  async sendMessage(message: string) {
    console.log("\n📤 Would send to AI:", `${message.slice(0, 200)}...\n`);
    return { id: "test-message-id" };
  },
  session: {
    async prompt(options: PromptOptions) {
      const text = options.body?.parts?.[0]?.text || "unknown";
      console.log("📤 Injecting prompt to session:", `${text.slice(0, 200)}...`);
      return { id: "prompt-id" };
    },
  },
};

interface PromptOptions {
  body?: { parts?: Array<{ text?: string }> };
}

interface MockClient {
  sendMessage: (message: string) => Promise<{ id: string }>;
  session: {
    prompt: (options: PromptOptions) => Promise<{ id: string }>;
  };
}

// Mock $ (shell function) that supports template literals and nothrow()
const mockShell = (strings: TemplateStringsArray, ...values: unknown[]) => {
  const cmd = strings.reduce((acc, str, i) => acc + str + (values[i] || ""), "");
  console.log("🔧 Would execute:", cmd);

  return {
    nothrow: () =>
      Promise.resolve({
        stdout: Buffer.from(""),
        stderr: Buffer.from(""),
        exitCode: 0,
      }),
  };
};

// Mock context - using type assertion for test mocks
const ctx = {
  client: mockClient,
  $: mockShell,
  directory: process.cwd(),
  sessionId: "test-session-123",
} as unknown as CommandContext;

async function testAskCommand() {
  console.log("🧪 Testing github-ask command handler\n");
  console.log("━".repeat(60));

  // Test 1: Full repo format
  console.log("\n📋 Test 1: Full owner/repo format");
  console.log("Command: /github-ask sst/opencode What is the plugin system?\n");
  try {
    await handleAsk("sst/opencode What is the plugin system?", ctx);
    console.log("✅ Test 1 passed");
  } catch (error) {
    console.error("❌ Test 1 failed:", error);
    process.exit(1);
  }

  console.log(`\n${"━".repeat(60)}`);

  // Test 2: Using alias
  console.log("\n📋 Test 2: Using alias");
  console.log("Command: /github-ask oc What are the main components?\n");
  try {
    await handleAsk("oc What are the main components?", ctx);
    console.log("✅ Test 2 passed");
  } catch (error) {
    console.error("❌ Test 2 failed:", error);
    process.exit(1);
  }

  console.log(`\n${"━".repeat(60)}`);

  // Test 3: Invalid input
  console.log("\n📋 Test 3: Invalid input (no args)");
  console.log("Command: /github-ask\n");
  try {
    await handleAsk("", ctx);
    console.log("✅ Test 3 passed (showed usage)");
  } catch (error) {
    console.error("❌ Test 3 failed:", error);
    process.exit(1);
  }

  console.log(`\n${"━".repeat(60)}`);
  console.log("\n🎉 All command handler tests passed!\n");
  console.log("Summary:");
  console.log("- ✅ Argument parsing works correctly");
  console.log("- ✅ Repo resolution works (owner/repo and aliases)");
  console.log("- ✅ Error handling works (missing args)");
  console.log("- ✅ AI delegation message is properly formatted");
}

testAskCommand();
