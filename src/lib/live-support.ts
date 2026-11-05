import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Mirrors giggre_app's lib/features/live_support/live_support_bubble.dart —
// explicitly marked TEMPORARY there, with its own full removal runbook (see
// that file's header comment). A floating bubble that opens a chat with a
// real "Giggre Support" account: a public account anyone can message
// straight away, no message request, no daily limit, even if it opted out
// of search (functions/src/liveSupport.ts's involvesLiveSupport bypasses all
// three inside startDirectChat). Configured per project in
// general_config/live_support — can be turned off there without a deploy.

export interface LiveSupportConfig {
  enabled: boolean;
  supportUid: string | null;
}

const DISABLED: LiveSupportConfig = { enabled: false, supportUid: null };

function toLiveSupportConfig(data: Record<string, unknown> | undefined): LiveSupportConfig {
  const uid = data?.supportUid;
  return data?.enabled === true && typeof uid === "string" && uid ? { enabled: true, supportUid: uid } : DISABLED;
}

export function subscribeLiveSupportConfig(
  onData: (config: LiveSupportConfig) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "general_config", "live_support"),
    (snap) => onData(toLiveSupportConfig(snap.data())),
    onError
  );
}
