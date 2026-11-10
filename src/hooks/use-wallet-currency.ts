"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

/** wallets/{uid}.currencyCode, live (null = no wallet / not signed in). */
export function useWalletCurrency(uid: string | undefined): string | null {
  const [ccy, setCcy] = useState<{ uid: string; code: string | null } | null>(null);
  useEffect(() => {
    if (!uid) return;
    let unsub: (() => void) | undefined;
    let alive = true;
    import("@/lib/firebase").then(({ db }) => {
      if (!alive) return;
      unsub = onSnapshot(
        doc(db, "wallets", uid),
        (snap) => {
          const c = snap.data()?.currencyCode;
          setCcy({ uid, code: typeof c === "string" && c ? c : null });
        },
        () => setCcy({ uid, code: null }),
      );
    }).catch(() => {});
    return () => {
      alive = false;
      unsub?.();
    };
  }, [uid]);
  return uid && ccy?.uid === uid ? ccy.code : null;
}
