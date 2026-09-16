"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageCircle, Plus, Search, Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppSelector } from "@/store/hooks";
import { findWorkerByUserId } from "@/lib/post-gig";
import {
  directMessageRoomId,
  fetchChatPeer,
  fetchOlderMessages,
  markRoomMessagesSeen,
  otherParticipant,
  OLDER_MESSAGES_PAGE_SIZE,
  sendDirectMessage,
  subscribeChatRooms,
  subscribeMessages,
  subscribeRoomUnread,
  type ChatMessage,
  type ChatPeer,
  type ChatRoom,
} from "@/lib/chat";

const SCROLL_TOP_THRESHOLD = 80;

function timeLabel(date: Date | null) {
  if (!date) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

function ChatRoomRow({
  room,
  myUid,
  peer,
  active,
  onSelect,
}: {
  room: ChatRoom;
  myUid: string;
  peer: ChatPeer | undefined;
  active: boolean;
  onSelect: () => void;
}) {
  const otherUid = otherParticipant(room, myUid);
  const [unread, setUnread] = useState(false);

  useEffect(() => {
    if (!otherUid) return;
    return subscribeRoomUnread(room.id, otherUid, setUnread);
  }, [room.id, otherUid]);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent ${
        active ? "bg-accent" : ""
      }`}
    >
      <Avatar className="size-10 shrink-0">
        <AvatarImage src={peer?.photoUrl || undefined} alt={peer?.name ?? ""} />
        <AvatarFallback>{initials(peer?.name ?? "?")}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-ink">{peer?.name ?? "…"}</p>
          <span className="shrink-0 text-[11px] text-muted">{timeLabel(room.lastMessageAt)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className={`truncate text-xs ${unread ? "font-semibold text-ink" : "text-muted"}`}>
            {room.lastMessageSenderId === myUid ? "You: " : ""}
            {room.lastMessage || "No messages yet"}
          </p>
          {unread && <span className="size-2 shrink-0 rounded-full bg-worker" aria-hidden />}
        </div>
      </div>
    </button>
  );
}

// Shared between /app/host/chat and /app/worker/chat — direct-message chat
// backed by the same `chat_rooms` collection the mobile app uses (see
// src/lib/chat.ts), so a conversation started here is visible in the
// mobile app too. Gig-scoped chat rooms and support tickets share the same
// collection/shape but aren't created from here.
export default function ChatPage() {
  const { authUser, profile } = useAppSelector((root) => root.user);
  const myUid = authUser?.uid;
  const myName = profile?.name || authUser?.displayName || "Me";

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [peers, setPeers] = useState<Map<string, ChatPeer>>(new Map());
  const [search, setSearch] = useState("");

  const [activePeer, setActivePeer] = useState<ChatPeer | null>(null);
  // The live window (most recent messages, real-time) and manually paginated
  // history (older messages, fetched once per page when scrolled to the
  // top) are tracked separately and merged for rendering — this way a new
  // incoming message never clobbers history the user scrolled back to load,
  // and loading older history never disturbs the live tail.
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const [olderMessages, setOlderMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatQuery, setNewChatQuery] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  const activeRoomId = myUid && activePeer ? directMessageRoomId(myUid, activePeer.uid) : null;
  // A brand-new conversation (started via the + lookup) has no room doc yet
  // — it's only created lazily on first send (see sendDirectMessage) — so
  // its id won't be in `rooms` until then. Querying the messages
  // subcollection of a room that doesn't exist is denied by the security
  // rules (they get() the parent room doc to check participants), so
  // messages/mark-seen must wait until the room actually exists.
  const roomExists = activeRoomId ? rooms.some((r) => r.id === activeRoomId) : false;

  useEffect(() => {
    if (!myUid) return;
    // Resetting before (re)subscribing, not reacting to loading itself.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const unsubscribe = subscribeChatRooms(
      myUid,
      (fetched) => {
        setRooms(fetched);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Failed to load chats:", err);
        setError("Couldn't load your conversations.");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [myUid]);

  // Resolves and caches the other participant's live profile for every room
  // as it shows up, so the list renders a name/avatar without depending on
  // the room doc's cached sendTo/createdByName fields (which represent
  // whichever side created the room, not necessarily the current viewer).
  useEffect(() => {
    if (!myUid) return;
    const missing = rooms
      .map((room) => otherParticipant(room, myUid))
      .filter((uid): uid is string => uid !== null && !peers.has(uid));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map((uid) => fetchChatPeer(uid))).then((fetched) => {
      if (cancelled) return;
      setPeers((prev) => {
        const next = new Map(prev);
        fetched.forEach((peer) => next.set(peer.uid, peer));
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [rooms, myUid, peers]);

  useEffect(() => {
    // Fresh room: reset pagination state and drop any previous room's
    // history before (re)subscribing.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOlderMessages([]);
    setHasMoreOlder(true);
    if (!activeRoomId || !roomExists) {
      setLiveMessages([]);
      return;
    }
    setMessagesLoading(true);
    const unsubscribe = subscribeMessages(
      activeRoomId,
      (fetched) => {
        setLiveMessages(fetched);
        setMessagesLoading(false);
      },
      (err) => {
        console.error("Failed to load messages:", err);
        setMessagesLoading(false);
      }
    );
    return unsubscribe;
  }, [activeRoomId, roomExists]);

  const messages = useMemo(() => {
    const seen = new Set<string>();
    const combined = [...olderMessages, ...liveMessages].filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
    combined.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return combined;
  }, [olderMessages, liveMessages]);

  // Marks the peer's messages as seen whenever the thread is open and the
  // message list changes — cheap (only queries unseen docs, no-ops if none).
  useEffect(() => {
    if (!activeRoomId || !activePeer || !roomExists) return;
    markRoomMessagesSeen(activeRoomId, activePeer.uid).catch((err) =>
      console.error("Failed to mark messages seen:", err)
    );
  }, [activeRoomId, activePeer, roomExists, liveMessages]);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const olderLoadAdjustRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);

  // Scrolls to the newest message on room switch or a real-time update —
  // deliberately keyed on liveMessages (not the combined `messages`), so
  // loading older history via handleLoadOlder never yanks the view back
  // down; that case is instead handled by the layout effect below, which
  // restores the pre-load scroll position.
  useEffect(() => {
    if (olderLoadAdjustRef.current) return;
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [activeRoomId, liveMessages]);

  // After older messages are prepended, the container's scrollHeight grows
  // and the browser keeps scrollTop unchanged — visually that jumps the
  // view further down into what's now "older" content. Restore the user's
  // original view by shifting scrollTop by exactly how much taller the
  // content became.
  useLayoutEffect(() => {
    const adjust = olderLoadAdjustRef.current;
    const container = messagesContainerRef.current;
    if (!adjust || !container) return;
    container.scrollTop = adjust.scrollTop + (container.scrollHeight - adjust.scrollHeight);
    olderLoadAdjustRef.current = null;
  }, [olderMessages]);

  async function handleLoadOlder() {
    if (!activeRoomId || loadingOlder || !hasMoreOlder || messages.length === 0) return;
    const container = messagesContainerRef.current;
    setLoadingOlder(true);
    try {
      const oldest = messages[0].createdAt;
      const fetched = await fetchOlderMessages(activeRoomId, oldest);
      if (fetched.length === 0) {
        setHasMoreOlder(false);
        return;
      }
      if (container) {
        olderLoadAdjustRef.current = { scrollHeight: container.scrollHeight, scrollTop: container.scrollTop };
      }
      setOlderMessages((prev) => [...fetched, ...prev]);
      if (fetched.length < OLDER_MESSAGES_PAGE_SIZE) setHasMoreOlder(false);
    } catch (err) {
      console.error("Failed to load older messages:", err);
    } finally {
      setLoadingOlder(false);
    }
  }

  function handleMessagesScroll(e: React.UIEvent<HTMLDivElement>) {
    if (e.currentTarget.scrollTop <= SCROLL_TOP_THRESHOLD) handleLoadOlder();
  }

  const filteredRooms = useMemo(() => {
    if (!myUid) return rooms;
    const q = search.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((room) => {
      const otherUid = otherParticipant(room, myUid);
      const name = otherUid ? (peers.get(otherUid)?.name ?? "") : "";
      return name.toLowerCase().includes(q);
    });
  }, [rooms, search, peers, myUid]);

  async function handleSelectRoom(room: ChatRoom) {
    if (!myUid) return;
    const otherUid = otherParticipant(room, myUid);
    if (!otherUid) return;
    const cached = peers.get(otherUid);
    setActivePeer(cached ?? (await fetchChatPeer(otherUid)));
  }

  async function handleStartChat() {
    const trimmed = newChatQuery.trim();
    if (!trimmed || !myUid) return;
    setLookingUp(true);
    try {
      const found = await findWorkerByUserId(trimmed);
      if (!found) {
        toast.error("No user found with that Giggre ID.");
        return;
      }
      if (found.uid === myUid) {
        toast.error("You can't message yourself.");
        return;
      }
      const peer: ChatPeer = { uid: found.uid, name: found.name, photoUrl: found.photoUrl };
      setPeers((prev) => new Map(prev).set(peer.uid, peer));
      setActivePeer(peer);
      setNewChatOpen(false);
      setNewChatQuery("");
    } catch (err) {
      console.error("Failed to look up user:", err);
      toast.error("Couldn't look up that user. Please try again.");
    } finally {
      setLookingUp(false);
    }
  }

  async function handleSend() {
    const text = messageText.trim();
    if (!text || !myUid || !activePeer || !activeRoomId) return;
    setSending(true);
    setMessageText("");
    try {
      await sendDirectMessage({
        roomId: activeRoomId,
        senderId: myUid,
        senderName: myName,
        text,
        peerUid: activePeer.uid,
        peerName: activePeer.name,
      });
    } catch (err) {
      console.error("Failed to send message:", err);
      toast.error("Couldn't send that message. Please try again.");
      setMessageText(text);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100svh-var(--header-height))] min-h-0 flex-col overflow-hidden p-4">
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-hairline">
        <div className="flex min-h-0 w-full max-w-xs shrink-0 flex-col border-r border-hairline">
          <div className="flex items-center gap-2 border-b border-hairline p-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-8" />
            </div>
            <Popover open={newChatOpen} onOpenChange={setNewChatOpen}>
              <PopoverTrigger render={<Button variant="outline" size="icon-sm" aria-label="New chat" />}>
                <Plus className="size-4" />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72">
                <div className="space-y-2 p-2">
                  <p className="text-xs font-medium text-muted">Start a conversation</p>
                  <Input
                    autoFocus
                    value={newChatQuery}
                    onChange={(e) => setNewChatQuery(e.target.value)}
                    placeholder="Enter a Giggre ID (e.g. ABC123456)"
                    onKeyDown={(e) => e.key === "Enter" && handleStartChat()}
                  />
                  <Button size="sm" className="w-full" disabled={lookingUp} onClick={handleStartChat}>
                    {lookingUp ? "Looking up…" : "Start Chat"}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : error ? (
              <p className="p-4 text-center text-sm text-destructive">{error}</p>
            ) : filteredRooms.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                <MessageCircle className="size-8 text-muted" />
                <p className="text-sm font-medium text-ink">No conversations yet</p>
                <p className="text-xs text-muted">Start a new chat with the + button above.</p>
              </div>
            ) : (
              filteredRooms.map((room) => {
                const otherUid = myUid ? otherParticipant(room, myUid) : null;
                return (
                  <ChatRoomRow
                    key={room.id}
                    room={room}
                    myUid={myUid ?? ""}
                    peer={otherUid ? peers.get(otherUid) : undefined}
                    active={activeRoomId === room.id}
                    onSelect={() => handleSelectRoom(room)}
                  />
                );
              })
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          {!activePeer ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <MessageCircle className="size-10 text-muted" />
              <p className="text-sm font-medium text-ink">Select a conversation</p>
              <p className="max-w-xs text-xs text-muted">
                Choose a conversation from the list, or start a new one, to begin chatting.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-hairline p-3">
                <Avatar className="size-9">
                  <AvatarImage src={activePeer.photoUrl || undefined} alt={activePeer.name} />
                  <AvatarFallback>{initials(activePeer.name)}</AvatarFallback>
                </Avatar>
                <p className="text-sm font-semibold text-ink">{activePeer.name}</p>
              </div>

              <div
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4"
              >
                {messagesLoading ? (
                  <Skeleton className="h-10 w-2/3" />
                ) : messages.length === 0 ? (
                  <p className="text-center text-xs text-muted">No messages yet — say hello!</p>
                ) : (
                  <>
                    {loadingOlder && (
                      <div className="flex justify-center py-1">
                        <Loader2 className="size-4 animate-spin text-muted" />
                      </div>
                    )}
                    {messages.map((message) => {
                      const mine = message.senderId === myUid;
                      return (
                        <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                              mine ? "bg-worker text-white" : "border border-hairline bg-card text-ink"
                            }`}
                          >
                            <p className="whitespace-pre-line">{message.text}</p>
                            <p className={`mt-0.5 text-[10px] ${mine ? "text-white/70" : "text-muted"}`}>
                              {timeLabel(message.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="flex items-center gap-2 border-t border-hairline p-3">
                <Input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Send message…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button size="icon" disabled={sending || !messageText.trim()} onClick={handleSend} aria-label="Send">
                  <Send className="size-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
