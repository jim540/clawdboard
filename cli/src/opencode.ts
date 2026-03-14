/**
 * OpenCode usage data extraction.
 *
 * Reads OpenCode's message JSON files from disk, aggregates by date and model,
 * calculates costs from token counts, and returns a SyncPayload.
 *
 * This mirrors the ccusage-based extraction in extract.ts but reads OpenCode's
 * native file format instead. The same privacy guarantees apply: only aggregate
 * metrics leave the machine — no prompts, code, file paths, or session IDs.
 *
 * OpenCode stores messages at:
 *   ~/.local/share/opencode/storage/message/{sessionID}/msg_{messageID}.json
 *
 * Each message JSON contains:
 *   - modelID: string (e.g., "claude-sonnet-4-20250514")
 *   - time.created: number (millisecond timestamp)
 *   - tokens.input, tokens.output, tokens.reasoning: number
 *   - tokens.cache.read, tokens.cache.write: number
 *   - cost: number (typically 0 — we calculate from tokens instead)
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { calculateCost } from "./pricing.js";
import { accumulate, accumulatorToSyncDays, type DayAccumulator } from "./accumulator.js";
import type { SyncDay } from "./schemas.js";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/**
 * Get the OpenCode data directory.
 * Respects OPENCODE_DATA_DIR env var, falls back to platform default.
 */
function getOpenCodeDataDir(): string {
  if (process.env.OPENCODE_DATA_DIR) {
    return process.env.OPENCODE_DATA_DIR;
  }

  const platform = process.platform;
  if (platform === "darwin") {
    return join(homedir(), ".local", "share", "opencode");
  }
  if (platform === "win32") {
    return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "opencode");
  }
  // Linux and others: XDG_DATA_HOME or ~/.local/share
  const xdgData = process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share");
  return join(xdgData, "opencode");
}

function getMessageStorageDir(): string {
  return join(getOpenCodeDataDir(), "storage", "message");
}

// ---------------------------------------------------------------------------
// Types (internal — only used for parsing, never sent to server)
// ---------------------------------------------------------------------------

interface OpenCodeMessage {
  modelID?: string;
  time?: { created?: number };
  tokens?: {
    input?: number;
    output?: number;
    reasoning?: number;
    cache?: { read?: number; write?: number };
  };
  cost?: number;
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

/**
 * Check whether OpenCode data exists on this machine.
 */
export function hasOpenCodeData(): boolean {
  return existsSync(getMessageStorageDir());
}

/**
 * Read all OpenCode message files and aggregate into daily usage data.
 *
 * PRIVACY: Only date, token counts, cost, and model names are extracted.
 * Session IDs, project paths, prompts, and tool outputs are never read.
 *
 * @param since - Optional YYYY-MM-DD date; messages before this are skipped.
 * @returns Array of SyncDay objects ready for Zod validation.
 */
export async function extractOpenCodeData(since?: string): Promise<SyncDay[]> {
  const messageDir = getMessageStorageDir();

  const sinceMs = since ? new Date(since).getTime() : 0;

  let sessionDirs: string[];
  try {
    sessionDirs = await readdir(messageDir);
  } catch {
    return [];
  }

  const byDate: Record<string, DayAccumulator> = {};

  for (const sessionDir of sessionDirs) {
    const sessionPath = join(messageDir, sessionDir);

    let dirStat;
    try {
      dirStat = await stat(sessionPath);
    } catch {
      continue;
    }
    if (!dirStat.isDirectory()) continue;

    // Quick skip: if the directory hasn't been modified since `since`, skip it
    if (sinceMs && dirStat.mtimeMs < sinceMs) continue;

    let messageFiles: string[];
    try {
      messageFiles = await readdir(sessionPath);
    } catch {
      continue;
    }

    for (const file of messageFiles) {
      if (!file.endsWith(".json")) continue;

      let msg: OpenCodeMessage;
      try {
        const raw = await readFile(join(sessionPath, file), "utf-8");
        msg = JSON.parse(raw) as OpenCodeMessage;
      } catch {
        continue;
      }

      const created = msg.time?.created;
      if (!created || typeof created !== "number") continue;
      if (sinceMs && created < sinceMs) continue;

      const date = new Date(created).toISOString().slice(0, 10);
      const modelId = msg.modelID ?? "unknown";

      const input = Number(msg.tokens?.input) || 0;
      const output = Number(msg.tokens?.output) || 0;
      const cacheWrite = Number(msg.tokens?.cache?.write) || 0;
      const cacheRead = Number(msg.tokens?.cache?.read) || 0;

      if (input === 0 && output === 0) continue;

      const cost =
        (Number(msg.cost) || 0) > 0
          ? Number(msg.cost)
          : calculateCost(modelId, {
              input,
              output,
              cacheCreation: cacheWrite,
              cacheRead,
            });

      accumulate(byDate, date, modelId, {
        input,
        output,
        cacheCreation: cacheWrite,
        cacheRead: cacheRead,
        cost,
      });
    }
  }

  return accumulatorToSyncDays(byDate, "opencode");
}
