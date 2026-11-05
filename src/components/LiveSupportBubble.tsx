"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { startDirectChat } from "@/lib/firebase-functions";
import { directMessageRoomId, subscribeRoomUnread } from "@/lib/chat";
import { subscribeLiveSupportConfig } from "@/lib/live-support";

const SUPPORT_NAME = "Giggre Support";

// Simplified web port of live_support_bubble.dart — a fixed corner button
// instead of the app's draggable/dockable one (a web page has no equivalent
// need to tuck a FAB out of the way of content underneath it). Hidden while
// already on the chat page itself, same as the app hides it on its chat
// route. Mounted once per role in the host/worker layout, not per page.
export default function LiveSupportBubble({ role }: { role: "host" | "worker" }) {
  const router = useRouter();
  const pathname = usePathname();
  const myUid = useAppSelector((root) => root.user.authUser?.uid);

  const [supportUid, setSupportUid] = useState<string | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (!myUid) return;
    return subscribeLiveSupportConfig(
      (config) => setSupportUid(config.supportUid),
      (err) => console.error("Failed to load live support config:", err)
    );
  }, [myUid]);

  useEffect(() => {
    if (!myUid || !supportUid || supportUid === myUid) {
      // Clearing stale unread state for a signed-out/unconfigured state, not
      // reacting to hasUnread itself.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasUnread(false);
      return;
    }
    return subscribeRoomUnread(directMessageRoomId(myUid, supportUid), supportUid, setHasUnread);
  }, [myUid, supportUid]);

  async function handleOpen() {
    if (!supportUid || opening) return;
    setOpening(true);
    try {
      await startDirectChat(supportUid);
      router.push(`/app/${role}/chat?peer=${supportUid}`);
    } catch (err) {
      console.error("Failed to start support chat:", err);
      const message = (err as { message?: string })?.message || "Couldn't open support chat. Please try again.";
      toast.error(message);
    } finally {
      setOpening(false);
    }
  }

  if (!myUid || !supportUid || supportUid === myUid || pathname?.includes("/chat")) return null;

  return (
    <button
      type="button"
      onClick={handleOpen}
      disabled={opening}
      aria-label={hasUnread ? `Chat with ${SUPPORT_NAME}, new message` : `Chat with ${SUPPORT_NAME}`}
      className="fixed right-5 bottom-5 z-50 flex size-16 items-center justify-center transition-transform hover:scale-105 active:scale-95"
    >
      {/* A speech-bubble shape (rounded square + a small tail at the bottom
          corner facing the screen edge), mirroring _ChatBubbleBorder in
          live_support_bubble.dart, instead of a plain circular FAB. */}
      <span className="absolute inset-0 rounded-2xl bg-card shadow-lg ring-1 ring-foreground/10" />
      <span className="absolute right-3 -bottom-1.5 size-3 rotate-45 rounded-[2px] bg-card shadow-[2px_2px_2px_-1px_rgba(0,0,0,0.12)]" />
      <span className="relative z-10 flex items-center justify-center pb-1">
        {opening ? (
          <Loader2 className="size-6 animate-spin text-muted" />
        ) : (
          <Image src="/assets/giggre_logo.png" alt="" width={40} height={40} className="object-contain" />
        )}
      </span>
      {hasUnread && !opening && (
        <span className="absolute top-0 right-0 z-10 size-3.5 rounded-full border-2 border-card bg-destructive" />
      )}
    </button>
  );
}
