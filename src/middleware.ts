import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { NextRequest, NextResponse } from "next/server";

const intlMiddleware = createMiddleware(routing);

export default function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";

  // Legacy redirect: clawdboard.vercel.app -> clawdboard.ai
  if (host === "clawdboard.vercel.app") {
    const url = req.nextUrl.clone();
    url.host = "clawdboard.ai";
    url.protocol = "https";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ["/((?!api|_next|dev|opengraph-image|.*\\..*).*)"],
};
