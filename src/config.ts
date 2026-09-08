import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Config, PromptConfig } from "./types.js";

const CONFIG_DIR = join(homedir(), ".config", "opencode");
const CONFIG_FILE = join(CONFIG_DIR, "ask-github.json");
const CACHE_DIR = join(homedir(), ".cache", "opencode-github");

const DEFAULT_PROMPT: PromptConfig = {
  agent: "explore",
};

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function getCacheDir(): string {
  return CACHE_DIR;
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getDefaultPrompt(): PromptConfig {
  return { ...DEFAULT_PROMPT };
}

function defaultConfig(): Config {
  return {
    aliases: {},
  };
}

export function loadConfig(): Config {
  if (!existsSync(CONFIG_FILE)) {
    return defaultConfig();
  }

  const content = readFileSync(CONFIG_FILE, "utf-8");
  const parsed = JSON.parse(content);
  return {
    aliases: parsed.aliases ?? {},
    prompt: parsed.prompt,
  };
}

export function getPromptConfig(config: Config): PromptConfig {
  return {
    agent: config.prompt?.agent ?? DEFAULT_PROMPT.agent,
  };
}

export function saveConfig(config: Config): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}
