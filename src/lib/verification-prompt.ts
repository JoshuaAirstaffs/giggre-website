const FRESH_LOGIN_KEY = "giggre:freshLogin";

/**
 * Marks that the user just completed a sign-in or registration in this tab —
 * call right before redirecting into the app. Mirrors giggre_app's
 * once-per-fresh-login gate (CurrentUserProvider.takeVerifyPromptAfterLogin),
 * which shows the "Account Not Verified" reminder only right after a fresh
 * login, never on a restored session. sessionStorage gives the same
 * distinction here: a plain page reload of an already-open dashboard tab
 * never calls this, so the marker is absent and the reminder stays quiet.
 */
export function markFreshLogin() {
  try {
    sessionStorage.setItem(FRESH_LOGIN_KEY, "1");
  } catch {}
}

/** Reads and clears the fresh-login marker — call once, on the app shell's first mount after a login. */
export function consumeFreshLogin(): boolean {
  try {
    const wasFresh = sessionStorage.getItem(FRESH_LOGIN_KEY) === "1";
    sessionStorage.removeItem(FRESH_LOGIN_KEY);
    return wasFresh;
  } catch {
    return false;
  }
}
