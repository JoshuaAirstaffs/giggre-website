import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/sessionConfig";

const protectedPrefixes = ["/select-role", "/app"];
const authRoutes = ["/login", "/register"];

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isProtected = protectedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

  if (isProtected && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (authRoutes.includes(path) && hasSession) {
    return NextResponse.redirect(new URL("/select-role", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/select-role", "/app/:path*", "/login", "/register"],
};
