/**
 * Codex CLI hook auto-installation.
 *
 * Installs a Stop hook in ~/.codex/config.toml that triggers
 * `npx clawdboard hook-sync` on session end.
 *
 * Codex uses TOML config (not JSON like Claude Code), so we do
 * minimal TOML manipulation — append the hook block if not present.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DEBOUNCE_MINUTES } from "./hook.js";
import { buildDebounceCommand, type InstallResult } from "./accumulator.js";

const CODEX_DIR = join(homedir(), ".codex");
const CONFIG_PATH = join(CODEX_DIR, "config.toml");

const HOOK_MARKER = "# clawdboard auto-sync";

/**
 * Build the TOML hook block to append to config.toml.
 */
function buildHookBlock(): string {
  const command = buildDebounceCommand(DEBOUNCE_MINUTES);

  return `
${HOOK_MARKER}
[[hooks.Stop]]
hooks = [{ type = "command", command = "${command}", timeout = 120 }]
`;
}

/**
 * Check if the clawdboard hook is already installed in Codex config.
 */
export function isCodexHookInstalled(): boolean {
  if (!existsSync(CONFIG_PATH)) return false;
  try {
    const content = readFileSync(CONFIG_PATH, "utf-8");
    return content.includes("clawdboard");
  } catch {
    return false;
  }
}

/**
 * Install the clawdboard Stop hook into Codex's config.toml.
 * Appends the hook block — does not parse or rewrite existing TOML.
 *
 * @returns Object indicating whether installation happened or was skipped
 */
export async function installCodexHook(): Promise<InstallResult> {
  // Read existing config (if any)
  let existing = "";
  if (existsSync(CONFIG_PATH)) {
    try {
      existing = await readFile(CONFIG_PATH, "utf-8");
    } catch {
      // Can't read — will create new
    }
  }

  // Check if already installed
  if (existing.includes("clawdboard")) {
    // Check if it has the current debounce value
    if (existing.includes(`mmin -${DEBOUNCE_MINUTES}`)) {
      return { installed: false, alreadyInstalled: true, updated: false };
    }

    // Update: remove old hook block and append new one
    const lines = existing.split("\n");
    const cleaned: string[] = [];
    let skipping = false;

    for (const line of lines) {
      if (line.includes(HOOK_MARKER)) {
        skipping = true;
        continue;
      }
      // The hook block is 2 lines after the marker (the [[hooks.Stop]] and hooks = [...])
      if (skipping) {
        if (line.startsWith("[[hooks.") || line.startsWith("hooks = ")) {
          continue;
        }
        skipping = false;
      }
      cleaned.push(line);
    }

    const updated = cleaned.join("\n").trimEnd() + "\n" + buildHookBlock();
    await writeFile(CONFIG_PATH, updated, "utf-8");
    return { installed: false, alreadyInstalled: false, updated: true };
  }

  // Fresh install — append to existing config or create new
  await mkdir(CODEX_DIR, { recursive: true });
  const content = existing.trimEnd() + "\n" + buildHookBlock();
  await writeFile(CONFIG_PATH, content, "utf-8");
  return { installed: true, alreadyInstalled: false, updated: false };
}
