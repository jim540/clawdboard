import { SyncPayloadSchema, type SyncPayload } from "./schemas.js";

/**
 * Privacy-preserving data extraction from raw ccusage DailyUsage data.
 *
 * This function is the core privacy boundary. It transforms raw ccusage output
 * (which may contain project paths, session IDs, git branches, and other
 * identifying information) into a clean SyncPayload containing ONLY aggregate
 * metrics.
 *
 * CRITICAL DESIGN DECISIONS:
 * 1. Uses explicit field picking (NOT object spread or Object.assign)
 * 2. Every field in the output is individually named in the code
 * 3. Result is validated through SyncPayloadSchema.parse() -- Zod catches any leakage
 * 4. Throws on validation failure (caller must handle)
 *
 * @param raw - Array of raw ccusage DailyUsage-like objects (typed as unknown[] for safety)
 * @returns A clean SyncPayload with only allowlisted fields
 * @throws ZodError if the sanitized data fails schema validation
 */
export function sanitizeDailyData(
  raw: unknown[],
  source?: "claude-code" | "opencode" | "codex" | null
): SyncPayload {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const days = (raw as any[]).map((day) => ({
    // ALLOWLISTED day-level fields only
    date: day.date,
    source: source ?? day.source ?? null,
    inputTokens: day.inputTokens,
    outputTokens: day.outputTokens,
    cacheCreationTokens: day.cacheCreationTokens,
    cacheReadTokens: day.cacheReadTokens,
    totalCost: day.totalCost,
    modelsUsed: [...day.modelsUsed],

    // ALLOWLISTED model breakdown fields only
    modelBreakdowns: (day.modelBreakdowns ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mb: any) => ({
        modelName: mb.modelName,
        inputTokens: mb.inputTokens,
        outputTokens: mb.outputTokens,
        cacheCreationTokens: mb.cacheCreationTokens,
        cacheReadTokens: mb.cacheReadTokens,
        cost: mb.cost,
      })
    ),
  }));

  // Validate through Zod -- catches any field leakage or malformed data
  return SyncPayloadSchema.parse({ days });
}

/**
 * Extract usage data from ccusage and sanitize it for upload.
 *
 * This function is the bridge between ccusage's data-loader API and our
 * privacy-preserving sync pipeline. It:
 * 1. Loads daily usage data from ccusage (reads local JSONL files)
 * 2. Passes the raw data through sanitizeDailyData (privacy allowlist)
 * 3. Returns a validated SyncPayload ready for upload
 *
 * Note: ccusage uses Valibot branded types at compile time, but runtime values
 * are plain strings/numbers. We cast through unknown[] for safety at the boundary.
 *
 * @param since - Optional YYYY-MM-DD date to filter data from (inclusive)
 * @returns A clean SyncPayload with only allowlisted fields
 * @throws Error if ccusage data directory not found or no data available
 */
export async function extractAndSanitize(
  since?: string
): Promise<SyncPayload> {
  // Dynamic import to avoid module resolution issues if ccusage not installed
  const { loadDailyUsageData } = await import("ccusage/data-loader");

  const options: Record<string, unknown> = {
    mode: "calculate",
  };

  if (since) {
    options.since = since;
  }

  // Load raw data from ccusage -- returns DailyUsage[] with Valibot branded types
  // Cast to unknown[] at the boundary for privacy-safe extraction
  const raw = await loadDailyUsageData(options as Parameters<typeof loadDailyUsageData>[0]);

  // Pass through privacy allowlist and Zod validation
  // Tag as "claude-code" source since ccusage reads Claude Code logs
  return sanitizeDailyData(raw as unknown[], "claude-code");
}
