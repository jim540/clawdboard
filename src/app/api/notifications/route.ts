import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getUnactedNotifications } from "@/lib/db/notifications";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, { key: "notifications", limit: 60 });
  if (limited) return limited;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notifications = await getUnactedNotifications(session.user.id);
  return NextResponse.json(notifications);
}
