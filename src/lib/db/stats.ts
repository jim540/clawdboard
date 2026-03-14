import "server-only";

import { db } from "@/lib/db";
import { dailyAggregates } from "./schema";
import { sql } from "drizzle-orm";

export interface SourceBreakdownEntry {
  source: string;
  totalCost: number;
  totalTokens: number;
  userCount: number;
}

/**
 * Get aggregate usage broken down by data source (claude-code, opencode, codex).
 * Rows with null source are grouped as "claude-code" (legacy data).
 */
export async function getSourceBreakdown(): Promise<SourceBreakdownEntry[]> {
  const rows = await db
    .select({
      source: sql<string>`COALESCE(${dailyAggregates.source}, 'claude-code')`.as("source"),
      totalCost: sql<number>`COALESCE(SUM(${dailyAggregates.totalCost}::numeric), 0)`.as("total_cost"),
      totalTokens: sql<number>`COALESCE(SUM(${dailyAggregates.inputTokens} + ${dailyAggregates.outputTokens} + ${dailyAggregates.cacheCreationTokens} + ${dailyAggregates.cacheReadTokens}), 0)`.as("total_tokens"),
      userCount: sql<number>`COUNT(DISTINCT ${dailyAggregates.userId})`.as("user_count"),
    })
    .from(dailyAggregates)
    .groupBy(sql`COALESCE(${dailyAggregates.source}, 'claude-code')`);

  return rows.map((r) => ({
    source: r.source,
    totalCost: Number(r.totalCost),
    totalTokens: Number(r.totalTokens),
    userCount: Number(r.userCount),
  }));
}
