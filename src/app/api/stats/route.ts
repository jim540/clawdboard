import { NextRequest, NextResponse } from "next/server";
import { getSourceBreakdown } from "@/lib/db/stats";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { key: "stats", limit: 30 });
  if (limited) return limited;

  try {
    const sourceBreakdown = await getSourceBreakdown();

    return NextResponse.json({
      sourceBreakdown,
    });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
