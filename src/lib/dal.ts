import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminAuth } from "@/lib/firebaseAdmin";
import { SESSION_COOKIE } from "@/lib/sessionConfig";

export const getSession = cache(async () => {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return null;

  try {
    const decoded = await getAdminAuth().verifySessionCookie(cookie, true);
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    return null;
  }
});

export async function verifySession() {
  const session = await getSession();
  if (!session) {
    // A present-but-invalid cookie (e.g. signed against a different
    // Firebase project than the server's currently configured for) needs to
    // actually be deleted before going to /login — otherwise the middleware
    // sees the cookie still there and immediately bounces /login back to
    // /select-role, which fails verification again: an infinite redirect
    // loop. A page render can't delete cookies itself (Next.js only allows
    // that in a Server Action or Route Handler), so this routes through one.
    const hasCookie = Boolean((await cookies()).get(SESSION_COOKIE)?.value);
    redirect(hasCookie ? "/api/auth/clear-session" : "/login");
  }
  return session;
}
