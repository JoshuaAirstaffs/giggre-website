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

/**
 * Reads and clears the fresh-login marker. Called exactly once, from
 * PostLoginModals' mount effect — deliberately NOT cached across calls: a
 * module-level cache would survive a logout→login cycle in the same tab
 * (client-side navigation doesn't reload the JS module), silently returning
 * a stale answer from the previous login instead of re-reading the fresh
 * marker the next sign-in just set.
 */
export function consumeFreshLogin(): boolean {
  try {
    const wasFresh = sessionStorage.getItem(FRESH_LOGIN_KEY) === "1";
    sessionStorage.removeItem(FRESH_LOGIN_KEY);
    return wasFresh;
  } catch {
    return false;
  }
}
