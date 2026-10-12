"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAppSelector } from "@/store/hooks";
import {
  fetchChatPeer,
  otherParticipant,
  subscribeChatRooms,
  type ChatPeer,
  type ChatRoom,
} from "@/lib/chat";

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

async function showNewMessageToast(room: ChatRoom, myUid: string, peers: Map<string, ChatPeer>) {
  const otherUid = otherParticipant(room, myUid);
  if (!otherUid) return;
  let peer = peers.get(otherUid);
  if (!peer) {
    try {
      peer = await fetchChatPeer(otherUid);
      peers.set(otherUid, peer);
    } catch (err) {
      console.error("Failed to resolve chat peer for toast:", err);
      return;
    }
  }
  const peerName = peer.name || "New message";

  toast(
    <div className="flex items-center gap-2.5">
      <Avatar className="size-8 shrink-0">
        <AvatarImage src={peer.photoUrl || undefined} alt={peerName} />
        <AvatarFallback>{initials(peerName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-wide text-muted uppercase">New Message</p>
        <p className="truncate text-sm font-medium text-ink">{peerName}</p>
        <p className="truncate text-xs text-muted">{room.lastMessage}</p>
      </div>
    </div>,
    { position: "top-right" }
  );
}

// Renders nothing — a headless subscription that pops the "new message"
// toast from *outside* the chat page too. ChatPage.tsx has its own copy of
// this same logic, but that one only runs while the chat page itself is
// mounted, so a message arriving while you're on the dashboard, My Gigs,
// etc. never surfaced. Mounted once in the host/worker layouts (always-on,
// unlike ChatPage) so it keeps running across every page in that section.
//
// Suppressed while already on a chat route via a ref (read inside the
// snapshot callback, not a subscribe dependency) so navigating to/from
// /chat doesn't tear down and resubscribe — that would reset the baseline
// and risk re-toasting a message that arrived just before the remount.
// ChatPage's own copy handles the in-chat-page case (skipping only the
// currently-open conversation); this one skips ALL chat-route toasts to
// avoid double-toasting the same message from both places.
export default function NewMessageToaster() {
  const myUid = useAppSelector((root) => root.user.authUser?.uid);
  const pathname = usePathname();

  const onChatRouteRef = useRef(false);
  useEffect(() => {
    onChatRouteRef.current = pathname?.includes("/chat") ?? false;
  }, [pathname]);

  const peersRef = useRef<Map<string, ChatPeer>>(new Map());
  const seenLastMessageAtRef = useRef<Map<string, number> | null>(null);

  useEffect(() => {
    if (!myUid) return;
    seenLastMessageAtRef.current = null;
    peersRef.current = new Map();
    return subscribeChatRooms(
      myUid,
      (rooms) => {
        const seen = seenLastMessageAtRef.current;
        if (!seen) {
          seenLastMessageAtRef.current = new Map(rooms.map((room) => [room.id, room.lastMessageAt?.getTime() ?? 0]));
          return;
        }
        rooms.forEach((room) => {
          const current = room.lastMessageAt?.getTime() ?? 0;
          const previous = seen.get(room.id) ?? 0;
          seen.set(room.id, current);
          if (current <= previous) return;
          if (room.lastMessageSenderId === myUid) return;
          if (onChatRouteRef.current) return;
          showNewMessageToast(room, myUid, peersRef.current);
        });
      },
      (err) => console.error("Failed to subscribe to chat rooms for toasts:", err)
    );
  }, [myUid]);

  return null;
}
