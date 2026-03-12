import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "../config.js";
import {
  readSettings,
  writeSettings,
  installHook,
} from "../settings.js";

/**
 * Core hook installation logic -- read settings, merge hook, write back.
 *
 * Extracted as a standalone function so it can be called from both
 * the `setup` command and the `auth` command (post-auth onboarding).
 *
 * @returns true if the hook was freshly installed, false if already present
 */
export async function runSetupHook(): Promise<boolean> {
  // Read current settings
  const currentSettings = await readSettings();

  // Install hook (pure merge)
  const { settings: newSettings, alreadyInstalled, migrated } =
    installHook(currentSettings);

  if (alreadyInstalled) {
    console.log(chalk.yellow("Auto-sync hook is already installed."));
    return false;
  }

  // Write merged settings
  await writeSettings(newSettings);

  if (migrated) {
    console.log(chalk.green("Migrated from ccboard to clawdboard!"));
  } else {
    console.log(
      chalk.dim(
        "Your data is live! Future usage syncs automatically every 2 hours."
      )
    );
  }
  console.log(
    chalk.dim(
      "Only numbers are shared — never your prompts, code, or project names."
    )
  );

  return true;
}

/**
 * Setup command -- Install the clawdboard auto-sync hook into Claude Code settings.
 *
 * Flow:
 * 1. Check for API token (require auth first)
 * 2. Read existing ~/.claude/settings.json
 * 3. Merge clawdboard Stop hook (preserving all existing hooks/settings)
 * 4. Write merged settings back
 * 5. Print activation instructions
 *
 * Idempotent: running twice does not duplicate the hook entry.
 */
export const setupCommand = new Command("setup")
  .description("Install auto-sync hook for Claude Code")
  .action(async () => {
    // Check authentication
    const config = await loadConfig();
    if (!config.apiToken) {
      console.error(
        chalk.red("Not authenticated. Run `clawdboard auth` first.")
      );
      process.exit(1);
    }

    const installed = await runSetupHook();

    if (!installed) {
      // Already installed -- exit cleanly
      process.exit(0);
    }
  });
