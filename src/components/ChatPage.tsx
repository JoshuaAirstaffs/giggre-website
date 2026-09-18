"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Ban, Check, CheckCheck, Flag, Loader2, MessageCircle, MoreVertical, Plus, Search, Send, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Message, MessageAvatar, MessageContent, MessageFooter } from "@/components/ui/message";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAppSelector } from "@/store/hooks";
import { cn } from "@/lib/utils";
import { fetchFavoriteWorkers, type WorkerLookupResult } from "@/lib/post-gig";
import { blockUser, subscribeBlockedUserIds } from "@/lib/browse-gigs";
import { CONTENT_REJECTION_MESSAGE, containsBlockedContent } from "@/lib/content-filter";
import { unblockUser } from "@/lib/blocked-users";
import { REPORT_REASONS, submitReport } from "@/lib/reports";
import {
  deleteMessage,
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
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors",
        active ? "bg-worker-tint" : "hover:bg-accent"
      )}
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
            {room.lastMessage && (room.lastMessageSenderId === myUid ? "You: " : peer?.name ? `${peer.name}: ` : "")}
            {room.lastMessage || "No messages yet"}
          </p>
          {unread && <Badge className="h-4.5 shrink-0 px-1.5 text-[10px]">New</Badge>}
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
  const searchParams = useSearchParams();
  const peerParam = searchParams.get("peer");

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
  const [favoriteWorkers, setFavoriteWorkers] = useState<WorkerLookupResult[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);

  const [myBlockedIds, setMyBlockedIds] = useState<Set<string>>(new Set());
  const [peerBlockedIds, setPeerBlockedIds] = useState<Set<string>>(new Set());
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockSubmitting, setBlockSubmitting] = useState(false);
  const [blockDone, setBlockDone] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);
  const [deletingMessage, setDeletingMessage] = useState(false);

  const activeRoomId = myUid && activePeer ? directMessageRoomId(myUid, activePeer.uid) : null;
  // Mirrors chat.dart's bidirectional block check — either side blocking
  // disables the composer, but only the blocker sees an "Unblock" action.
  const isBlocked = activePeer ? myBlockedIds.has(activePeer.uid) : false;
  const isBlockedByPeer = myUid ? peerBlockedIds.has(myUid) : false;
  const chatDisabled = isBlocked || isBlockedByPeer;
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

  useEffect(() => {
    if (!myUid) return;
    return subscribeBlockedUserIds(myUid, (ids) => setMyBlockedIds(new Set(ids)));
  }, [myUid]);

  // The peer side of the bidirectional block check — only needs to track
  // whoever the active conversation is with.
  useEffect(() => {
    if (!activePeer?.uid) {
      // Clearing before (re)subscribing, not reacting to peerBlockedIds itself.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPeerBlockedIds(new Set());
      return;
    }
    return subscribeBlockedUserIds(activePeer.uid, (ids) => setPeerBlockedIds(new Set(ids)));
  }, [activePeer?.uid]);

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

  // Toasts (top-right, distinct from the app-wide top-center default) when a
  // room's lastMessage moves forward from someone other than me, unless it's
  // the conversation currently open — that one's new message is already
  // visible in the transcript. Skipped on the very first snapshot so opening
  // the page doesn't toast for every existing conversation at once.
  const seenLastMessageAtRef = useRef<Map<string, number> | null>(null);
  // Resetting whenever a fresh rooms subscription starts (uid change or
  // remount), so a re-login doesn't reuse a stale baseline from a previous
  // session/account.
  useEffect(() => {
    seenLastMessageAtRef.current = null;
  }, [myUid]);
  useEffect(() => {
    // `rooms` starts as [] before subscribeChatRooms's first snapshot
    // resolves — waiting for `loading` to clear ensures the baseline below
    // is captured from the real initial list, not that placeholder empty
    // one (which would otherwise make every already-existing room's last
    // message look "new" the moment real data arrives).
    if (!myUid || loading) return;
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
      if (room.id === activeRoomId) return;
      const otherUid = otherParticipant(room, myUid);
      const peer = otherUid ? peers.get(otherUid) : undefined;
      const peerName = peer?.name || "New message";
      toast(
        <div className="flex items-center gap-2.5">
          <Avatar className="size-8 shrink-0">
            <AvatarImage src={peer?.photoUrl || undefined} alt={peerName} />
            <AvatarFallback>{initials(peerName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium tracking-wide text-muted uppercase">New Message</p>
              <span className="shrink-0 text-[10px] text-muted">{timeLabel(room.lastMessageAt)}</span>
            </div>
            <p className="truncate text-sm font-medium text-ink">{peerName}</p>
            <p className="truncate text-xs text-muted">{room.lastMessage}</p>
          </div>
        </div>,
        { position: "top-right" }
      );
    });
  }, [rooms, myUid, activeRoomId, peers, loading]);

  // Arriving via a "Message" link elsewhere in the site (e.g. the Favorites
  // page, ?peer=<uid>) — opens straight into that conversation the same way
  // handleSelectRoom/handleStartChat do (cache lookup, else fetchChatPeer),
  // without creating a room doc: that still only happens lazily on first
  // send (see sendDirectMessage).
  useEffect(() => {
    if (!peerParam || !myUid || peerParam === myUid) return;
    if (activePeer?.uid === peerParam) return;
    let cancelled = false;
    const cached = peers.get(peerParam);
    (cached ? Promise.resolve(cached) : fetchChatPeer(peerParam)).then((peer) => {
      if (!cancelled) setActivePeer(peer);
    });
    return () => {
      cancelled = true;
    };
  }, [peerParam, myUid, peers, activePeer]);

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
    // liveMessages first: for any id present in both (the live window and
    // the paginated history can overlap), the reactive live copy must win
    // over the older static one-time-fetched copy, or edits like delete
    // never show up until a full refetch.
    const seen = new Set<string>();
    const combined = [...liveMessages, ...olderMessages].filter((m) => {
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

  // "Start a conversation" only picks from favorites, not a full user
  // search — reloaded each time the popover opens so a favorite added
  // elsewhere shows up without a page refresh.
  useEffect(() => {
    if (!newChatOpen || !myUid) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingFavorites(true);
    fetchFavoriteWorkers(myUid)
      .then((results) => {
        if (!cancelled) setFavoriteWorkers(results);
      })
      .catch((err) => {
        console.error("Failed to load favorites:", err);
        if (!cancelled) setFavoriteWorkers([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingFavorites(false);
      });
    return () => {
      cancelled = true;
    };
  }, [newChatOpen, myUid]);

  const newChatResults = useMemo(() => {
    const q = newChatQuery.trim().toLowerCase();
    if (!q) return favoriteWorkers;
    return favoriteWorkers.filter((u) => u.name.toLowerCase().includes(q));
  }, [favoriteWorkers, newChatQuery]);

  function handleStartChat(found: WorkerLookupResult) {
    const peer: ChatPeer = { uid: found.uid, name: found.name, photoUrl: found.photoUrl };
    setPeers((prev) => new Map(prev).set(peer.uid, peer));
    setActivePeer(peer);
    setNewChatOpen(false);
    setNewChatQuery("");
  }

  async function handleSend() {
    const text = messageText.trim();
    if (!text || !myUid || !activePeer || !activeRoomId) return;
    // Mirrors chat.dart's _sendMessage: checked before clearing the composer,
    // so a blocked message stays in the input for the user to revise.
    if (await containsBlockedContent(text)) {
      toast.error(CONTENT_REJECTION_MESSAGE);
      return;
    }
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

  function closeBlockDialog(open: boolean) {
    setBlockDialogOpen(open);
    if (!open) setBlockDone(false);
  }

  // Mirrors _toggleBlockUser in chat.dart — writes only to the acting user's
  // own doc; the peer's doc is never touched either way.
  async function handleToggleBlock() {
    if (!myUid || !activePeer || blockSubmitting) return;
    setBlockSubmitting(true);
    try {
      if (isBlocked) {
        await unblockUser(myUid, activePeer.uid);
      } else {
        await blockUser(myUid, activePeer.uid);
      }
      setBlockDone(true);
    } catch (err) {
      console.error("Failed to update block status:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBlockSubmitting(false);
    }
  }

  function closeReportDialog(open: boolean) {
    setReportOpen(open);
    if (!open) {
      setReportReason(null);
      setReportDetails("");
      setReportSubmitted(false);
    }
  }

  async function handleSubmitReport() {
    if (!myUid || !activePeer || !reportReason || reportSubmitting) return;
    setReportSubmitting(true);
    try {
      await submitReport({
        contentType: "user",
        contentId: activePeer.uid,
        contentSnapshot: "",
        surface: "chat",
        reporterId: myUid,
        reportedUserId: activePeer.uid,
        reportedUserName: activePeer.name,
        reason: reportReason,
        details: reportDetails.trim(),
      });
      setReportSubmitted(true);
    } catch (err) {
      console.error("Failed to submit report:", err);
      toast.error("Couldn't submit this report. Please try again.");
    } finally {
      setReportSubmitting(false);
    }
  }

  async function handleDeleteMessage() {
    if (!activeRoomId || !deleteTarget || deletingMessage) return;
    setDeletingMessage(true);
    const deletedId = deleteTarget.id;
    try {
      await deleteMessage(activeRoomId, deletedId);
      // Optimistic local update — a message loaded via the one-time
      // fetchOlderMessages page has no listener on it, so without this it
      // wouldn't show as removed until the thread is reopened. Applied to
      // both lists since we don't know up front which one holds it.
      const markDeleted = (list: ChatMessage[]) =>
        list.map((m) => (m.id === deletedId ? { ...m, isDeleted: true } : m));
      setLiveMessages(markDeleted);
      setOlderMessages(markDeleted);
      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to delete message:", err);
      toast.error("Couldn't delete this message. Please try again.");
    } finally {
      setDeletingMessage(false);
    }
  }

  return (
    <>
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
                    placeholder="Filter favorites…"
                  />
                  <div className="max-h-56 space-y-0.5 overflow-y-auto">
                    {loadingFavorites ? (
                      <p className="p-2 text-center text-xs text-muted">Loading favorites…</p>
                    ) : newChatResults.length === 0 ? (
                      <p className="p-2 text-center text-xs text-muted">
                        {newChatQuery.trim() ? "No favorites match that name." : "No favorites yet."}
                      </p>
                    ) : (
                      newChatResults.map((user) => (
                        <button
                          key={user.uid}
                          type="button"
                          onClick={() => handleStartChat(user)}
                          className="flex w-full items-center gap-2 rounded-md p-1.5 text-left text-sm hover:bg-accent"
                        >
                          <Avatar className="size-7 shrink-0">
                            <AvatarImage src={user.photoUrl || undefined} alt={user.name} />
                            <AvatarFallback>{initials(user.name)}</AvatarFallback>
                          </Avatar>
                          <span className="truncate">{user.name}</span>
                        </button>
                      ))
                    )}
                  </div>
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
                <p className="flex-1 text-sm font-semibold text-ink">{activePeer.name}</p>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Conversation actions" />}>
                    <MoreVertical className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setReportOpen(true)}>
                      <Flag className="size-3.5 text-orange-500" />
                      Report user
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setBlockDialogOpen(true)}>
                      <Ban className="size-3.5 text-red-500" />
                      {isBlocked ? "Unblock user" : "Block user"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
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
                      const avatarName = mine ? myName : activePeer.name;
                      const avatarPhotoUrl = mine ? profile?.photoUrl : activePeer.photoUrl;
                      const canDelete = mine && !message.isDeleted;
                      return (
                        <Message key={message.id} align={mine ? "end" : "start"}>
                          <MessageAvatar>
                            <Avatar className="size-8">
                              <AvatarImage src={avatarPhotoUrl || undefined} alt={avatarName} />
                              <AvatarFallback>{initials(avatarName)}</AvatarFallback>
                            </Avatar>
                          </MessageAvatar>
                          <MessageContent>
                            <div
                              className={cn(
                                "group/bubble flex max-w-[75%] items-center gap-1.5",
                                mine ? "self-end flex-row-reverse" : "self-start"
                              )}
                            >
                              <div
                                className={cn(
                                  "min-w-0 rounded-2xl px-3 py-2 text-sm",
                                  message.isDeleted
                                    ? "border border-hairline bg-muted/40 text-muted"
                                    : mine
                                      ? "bg-worker text-white"
                                      : "border border-hairline bg-card text-ink"
                                )}
                              >
                                {message.isDeleted ? (
                                  <p className="text-xs italic">Message has been removed</p>
                                ) : (
                                  <p className="whitespace-pre-line">{message.text}</p>
                                )}
                              </div>
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="shrink-0 text-muted opacity-0 transition-opacity group-hover/bubble:opacity-100 hover:text-destructive"
                                  aria-label="Delete message"
                                  onClick={() => setDeleteTarget(message)}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              )}
                            </div>
                            <MessageFooter className={cn("gap-1 text-muted", mine && "justify-end")}>
                              <span>{timeLabel(message.createdAt)}</span>
                              {mine && message.hasSeenByPeer && <CheckCheck className="size-3" aria-label="Seen" />}
                            </MessageFooter>
                          </MessageContent>
                        </Message>
                      );
                    })}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>

              {chatDisabled ? (
                <div className="flex items-center gap-2 border-t border-hairline bg-muted/50 p-3 text-sm text-muted-foreground">
                  <Ban className="size-4 shrink-0 text-red-400" />
                  {isBlocked ? (
                    <>
                      <span className="flex-1">You&apos;ve blocked this user.</span>
                      <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setBlockDialogOpen(true)}>
                        Unblock
                      </Button>
                    </>
                  ) : (
                    <span>This user has blocked you.</span>
                  )}
                </div>
              ) : (
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
              )}
            </>
          )}
        </div>
      </div>
    </div>

    <Dialog open={blockDialogOpen} onOpenChange={closeBlockDialog}>
      <DialogContent>
        {blockDone ? (
          <>
            <DialogHeader>
              <DialogTitle>{isBlocked ? "User blocked" : "User unblocked"}</DialogTitle>
              <DialogDescription>
                {isBlocked
                  ? `${activePeer?.name} has been blocked. You won't see their content anymore, and they can't message you.`
                  : `You'll be able to message ${activePeer?.name} again.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => closeBlockDialog(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{isBlocked ? `Unblock ${activePeer?.name}?` : `Block ${activePeer?.name}?`}</DialogTitle>
              <DialogDescription>
                {isBlocked
                  ? "You'll be able to message each other again."
                  : "Neither of you will be able to send messages to each other. You can undo this anytime."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => closeBlockDialog(false)} disabled={blockSubmitting}>
                Cancel
              </Button>
              <Button
                variant={isBlocked ? "default" : "destructive"}
                disabled={blockSubmitting}
                onClick={handleToggleBlock}
              >
                {blockSubmitting ? "Please wait…" : isBlocked ? "Unblock user" : "Block user"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>

    <Dialog open={reportOpen} onOpenChange={closeReportDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report {activePeer?.name}</DialogTitle>
          <DialogDescription>Tell us what&apos;s wrong. Reports are confidential.</DialogDescription>
        </DialogHeader>

        {reportSubmitted ? (
          <p className="text-sm text-ink">Report received. Our team will review and resolve this within 24 hours.</p>
        ) : (
          <>
            <div className="space-y-1.5">
              {REPORT_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setReportReason(reason)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    reportReason === reason ? "border-worker bg-worker-tint text-ink" : "border-hairline hover:bg-mist"
                  )}
                >
                  {reason}
                  {reportReason === reason && <Check className="size-4 text-(--worker-text)" />}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="chat-report-details">Additional details (optional)</Label>
              <Textarea
                id="chat-report-details"
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                rows={3}
                placeholder="Add any extra context…"
              />
            </div>
          </>
        )}

        <DialogFooter>
          {reportSubmitted ? (
            <Button onClick={() => closeReportDialog(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => closeReportDialog(false)} disabled={reportSubmitting}>
                Cancel
              </Button>
              <Button disabled={!reportReason || reportSubmitting} onClick={handleSubmitReport}>
                {reportSubmitting ? "Submitting…" : "Submit report"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this message?</DialogTitle>
          <DialogDescription>
            It will be replaced with &quot;Message has been removed&quot; for both of you. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deletingMessage}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDeleteMessage} disabled={deletingMessage}>
            {deletingMessage ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
