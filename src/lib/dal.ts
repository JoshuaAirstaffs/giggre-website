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
  if (!session) redirect("/login");
  return session;
}
