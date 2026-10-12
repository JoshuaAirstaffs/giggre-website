import { NextResponse } from "next/server";
import { deleteSessionCookie } from "@/lib/session";

// A session cookie can exist (so the middleware's cheap presence check lets
// it through) while failing real verification in dal.ts's getSession — e.g.
// it was signed against a different Firebase project than the one the
// server is currently configured for. Redirecting straight to /login in
// that case doesn't help: the invalid cookie is still there, so the
// middleware immediately bounces /login back to /select-role, which fails
// verification again — an infinite redirect loop (Chrome eventually reports
// this as "Throttling navigation to prevent the browser from hanging").
// This route breaks that loop by actually deleting the cookie before
// sending the browser to /login.
export async function GET(request: Request) {
  await deleteSessionCookie();
  return NextResponse.redirect(new URL("/login", request.url));
}

export const dynamic = "force-dynamic";
