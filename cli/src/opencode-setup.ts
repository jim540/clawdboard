/**
 * OpenCode plugin auto-installation.
 *
 * Mirrors the Claude Code hook setup in settings.ts:
 * drops a plugin file into ~/.config/opencode/plugins/clawdboard.ts
 * so that OpenCode auto-syncs usage data to clawdboard.
 *
 * The plugin is a thin wrapper (~20 lines) that triggers
 * `npx clawdboard hook-sync` on session.idle with shell-level debounce.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DEBOUNCE_MINUTES } from "./hook.js";
import type { InstallResult } from "./accumulator.js";

const OPENCODE_PLUGINS_DIR = join(homedir(), ".config", "opencode", "plugins");
const PLUGIN_PATH = join(OPENCODE_PLUGINS_DIR, "clawdboard.ts");

/**
 * The plugin source code, embedded as a string.
 * This is the same code as opencode-plugin/src/index.ts but self-contained
 * so the CLI can write it without depending on the opencode-plugin package.
 */
function getPluginSource(): string {
  return `/**
 * clawdboard plugin for OpenCode — auto-installed by \`npx clawdboard auth\`
 *
 * Triggers \`npx clawdboard hook-sync\` on session.idle with shell-level debounce.
 * The CLI handles all data extraction, privacy sanitization, and upload.
 *
 * To uninstall, delete this file: ~/.config/opencode/plugins/clawdboard.ts
 */

const DEBOUNCE_MINUTES = ${DEBOUNCE_MINUTES};

export default async ({ $ }: any) => ({
  "session.idle": async () => {
    try {
      await $\`bash -c \${
        \`f=$HOME/.clawdboard/last-sync; [ -f "$f" ] && [ -n "$(find "$f" -mmin -\${DEBOUNCE_MINUTES} 2>/dev/null)" ] && exit 0; npx clawdboard hook-sync\`
      }\`.quiet();
    } catch {}
  },
});
`;
}

/**
 * Check if the clawdboard OpenCode plugin is already installed.
 */
export function isOpenCodePluginInstalled(): boolean {
  if (!existsSync(PLUGIN_PATH)) return false;

  try {
    // Check if the file contains clawdboard (could be an old version)
    const content = readFileSync(PLUGIN_PATH, "utf-8");
    return content.includes("clawdboard");
  } catch {
    return false;
  }
}

/**
 * Install the clawdboard plugin into OpenCode's global plugins directory.
 *
 * @returns Object indicating whether installation happened or was skipped
 */
export async function installOpenCodePlugin(): Promise<InstallResult> {
  // Check if already installed with current debounce value
  if (existsSync(PLUGIN_PATH)) {
    try {
      const existing = await readFile(PLUGIN_PATH, "utf-8");
      if (
        existing.includes("clawdboard") &&
        existing.includes(`DEBOUNCE_MINUTES = ${DEBOUNCE_MINUTES}`)
      ) {
        return { installed: false, alreadyInstalled: true, updated: false };
      }
      // Exists but outdated — update it
      await writeFile(PLUGIN_PATH, getPluginSource(), "utf-8");
      return { installed: false, alreadyInstalled: false, updated: true };
    } catch {
      // Can't read existing file — overwrite
    }
  }

  // Fresh install
  await mkdir(OPENCODE_PLUGINS_DIR, { recursive: true });
  await writeFile(PLUGIN_PATH, getPluginSource(), "utf-8");
  return { installed: true, alreadyInstalled: false, updated: false };
}
