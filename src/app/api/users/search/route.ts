import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { searchUsers } from "@/lib/db/users";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, { key: "user-search", limit: 30 });
  if (limited) return limited;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q")?.trim() ?? "";
  const excludeTeam = searchParams.get("excludeTeam") ?? undefined;

  if (query.length < 2) {
    return NextResponse.json([]);
  }

  const results = await searchUsers(query, excludeTeam);
  return NextResponse.json(results);
}
