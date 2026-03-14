import { NextRequest, NextResponse, after } from "next/server";
import { revalidatePath } from "next/cache";
import { revalidateAllCaches } from "@/lib/db/cached";
import { db } from "@/lib/db";
import { dailyAggregates, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { SyncPayloadSchema } from "@/lib/sync/validate";
import { rateLimit } from "@/lib/rate-limit";
import { isOrgDataStale, syncUserGitHubOrgs } from "@/lib/db/github-orgs";

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { key: "sync", limit: 10 });
  if (limited) return limited;

  try {
    // 1. Authenticate via Bearer token
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return NextResponse.json(
        { error: "Missing authorization token" },
        { status: 401 }
      );
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.apiToken, token))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // 2. Size check
    const contentLength = parseInt(
      req.headers.get("content-length") ?? "0",
      10
    );
    if (contentLength > 100_000) {
      return NextResponse.json(
        { error: "Payload too large (max 100KB)" },
        { status: 413 }
      );
    }

    // 3. Parse and validate with Zod
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const result = SyncPayloadSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: result.error.issues },
        { status: 400 }
      );
    }

    // 4. Upsert each day within a single transaction (Pitfall 6: avoid Vercel timeout)
    const { days, syncIntervalMs } = result.data;

    await Promise.all(
      days.map((day) =>
        db
          .insert(dailyAggregates)
          .values({
            userId: user.id,
            date: day.date,
            source: day.source ?? null,
            inputTokens: day.inputTokens,
            outputTokens: day.outputTokens,
            cacheCreationTokens: day.cacheCreationTokens,
            cacheReadTokens: day.cacheReadTokens,
            totalCost: day.totalCost.toString(),
            modelsUsed: day.modelsUsed,
            modelBreakdowns: day.modelBreakdowns,
          })
          .onConflictDoUpdate({
            target: [dailyAggregates.userId, dailyAggregates.date, dailyAggregates.source],
            set: {
              inputTokens: day.inputTokens,
              outputTokens: day.outputTokens,
              cacheCreationTokens: day.cacheCreationTokens,
              cacheReadTokens: day.cacheReadTokens,
              totalCost: day.totalCost.toString(),
              modelsUsed: day.modelsUsed,
              modelBreakdowns: day.modelBreakdowns,
              syncedAt: new Date(),
            },
          })
      )
    );

    // 5. Update user's last sync timestamp (must be synchronous so the
    //    homepage sees hasSynced=true when the browser redirects after device auth)
    await db
      .update(users)
      .set({ lastSyncAt: new Date(), ...(syncIntervalMs != null && { syncIntervalMs }) })
      .where(eq(users.id, user.id));

    // 6. Invalidate all cached data so the next page visit shows fresh results.
    revalidateAllCaches();
    revalidatePath("/");

    // 7. Sync GitHub orgs in the background (slow, non-critical)
    after(async () => {
      if (isOrgDataStale(user.githubOrgsFetchedAt)) {
        syncUserGitHubOrgs(user.id).catch((err) =>
          console.error("[sync] org sync failed:", err)
        );
      }
    });

    return NextResponse.json({
      success: true,
      daysUpserted: days.length,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
