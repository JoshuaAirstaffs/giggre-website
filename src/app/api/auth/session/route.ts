import { getAdminAuth } from "@/lib/firebaseAdmin";
import { SESSION_MAX_AGE_MS, setSessionCookie, deleteSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  const { idToken } = await request.json();

  if (typeof idToken !== "string" || !idToken) {
    return Response.json({ error: "Missing idToken." }, { status: 400 });
  }

  try {
    const adminAuth = getAdminAuth();
    // Require a freshly-issued token so a stolen session cookie can't be minted from an old one.
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    });
    await setSessionCookie(sessionCookie);
    return Response.json({ uid: decoded.uid });
  } catch {
    return Response.json({ error: "Could not verify sign-in." }, { status: 401 });
  }
}

export async function DELETE() {
  await deleteSessionCookie();
  return new Response(null, { status: 204 });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
