import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// Mirrors giggre_app's chat feature — lib/screens/chat/chat.dart,
// lib/screens/chat/home_chat.dart, lib/features/chat/worker_message_action.dart
// — same `chat_rooms` collection and field names, so a DM started on the
// website shows up correctly in the mobile app's chat list/thread and vice
// versa. Scoped to direct-message (dm_...) rooms only: gig-scoped rooms
// (`gig_{gigId}`) and support tickets share the same collection/shape but
// aren't created from the website yet — this only needs generic person-to-
// person chat, and a `participants array-contains uid` query surfaces any
// existing gig-chat rooms the account is already part of too, for free.

export function directMessageRoomId(uidA: string, uidB: string): string {
  return `dm_${[uidA, uidB].sort().join("_")}`;
}

export interface ChatRoom {
  id: string;
  participants: string[];
  sendTo: string;
  createdByUid: string;
  createdByName: string;
  lastMessage: string;
  lastMessageSenderId: string;
  lastMessageAt: Date | null;
  gigId: string;
  isGigChat: boolean;
  status: string;
}

function toChatRoom(id: string, data: Record<string, unknown>): ChatRoom {
  return {
    id,
    participants: (data.participants as string[] | undefined) ?? [],
    sendTo: (data.sendTo as string | undefined) ?? "",
    createdByUid: (data.createdByUid as string | undefined) ?? "",
    createdByName: (data.createdByName as string | undefined) ?? "",
    lastMessage: (data.lastMessage as string | undefined) ?? "",
    lastMessageSenderId: (data.lastMessageSenderId as string | undefined) ?? "",
    lastMessageAt: (data.lastMessageAt as Timestamp | undefined)?.toDate() ?? null,
    gigId: (data.gigId as string | undefined) ?? "",
    isGigChat: (data.isGigChat as boolean | undefined) ?? false,
    status: (data.status as string | undefined) ?? "open",
  };
}

// No orderBy here on purpose — matches home_chat.dart's _GigChatsTab, which
// fetches every matching room live then sorts by lastMessageAt client-side,
// avoiding a composite index on (participants, lastMessageAt).
export function subscribeChatRooms(
  uid: string,
  onData: (rooms: ChatRoom[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "chat_rooms"), where("participants", "array-contains", uid)),
    (snap) => {
      const rooms = snap.docs.map((d) => toChatRoom(d.id, d.data()));
      rooms.sort((a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0));
      onData(rooms);
    },
    onError
  );
}

export interface ChatPeer {
  uid: string;
  name: string;
  photoUrl: string;
}

export function otherParticipant(room: ChatRoom, myUid: string): string | null {
  return room.participants.find((id) => id !== myUid) ?? null;
}

export async function fetchChatPeer(uid: string): Promise<ChatPeer> {
  const snap = await getDoc(doc(db, "users", uid));
  const data = snap.data();
  return {
    uid,
    name: (data?.name as string | undefined) || "Unknown",
    photoUrl: (data?.photoUrl as string | undefined) ?? "",
  };
}

export interface ChatMessage {
  id: string;
  senderId: string;
  name: string;
  text: string;
  hasSeen: boolean;
  // Drives the sent-message "seen" checkmark (mirrors chat.dart's
  // hasSeenByPeer) — distinct from `hasSeen`, which only feeds the chat
  // list's unread indicator.
  hasSeenByPeer: boolean;
  createdAt: Date;
  // Web-only, no giggre_app equivalent yet — set by deleteMessage below.
  // Soft-deleted rather than removed so the thread doesn't visibly shrink
  // and any unread/last-message bookkeeping tied to the doc stays intact;
  // the client renders it as "Message has been removed" instead of `text`.
  isDeleted: boolean;
}

// The live window covers the most recent messages in real time; anything
// older is fetched on demand (see fetchOlderMessages) when the thread is
// scrolled to the top, rather than chat.dart's up-front paginated history.
const MESSAGE_WINDOW = 50;
export const OLDER_MESSAGES_PAGE_SIZE = 30;

function toChatMessage(id: string, data: Record<string, unknown>): ChatMessage {
  return {
    id,
    senderId: (data.senderId as string | undefined) ?? "",
    name: (data.name as string | undefined) ?? "",
    text: (data.text as string | undefined) ?? "",
    hasSeen: (data.hasSeen as boolean | undefined) ?? false,
    hasSeenByPeer: (data.hasSeenByPeer as boolean | undefined) ?? false,
    createdAt: (data.createdAt as Timestamp | undefined)?.toDate() ?? new Date(),
    isDeleted: (data.isDeleted as boolean | undefined) ?? false,
  };
}

export function subscribeMessages(
  roomId: string,
  onData: (messages: ChatMessage[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "chat_rooms", roomId, "messages"), orderBy("createdAt", "asc"), limitToLast(MESSAGE_WINDOW)),
    (snap) => onData(snap.docs.map((d) => toChatMessage(d.id, d.data()))),
    onError
  );
}

// One-time fetch for history older than what the live window covers,
// triggered by scrolling to the top of the thread. Filters and sorts on the
// same `createdAt` field, so this only needs Firestore's automatic
// single-field index — no composite index required.
export async function fetchOlderMessages(
  roomId: string,
  before: Date,
  pageSize: number = OLDER_MESSAGES_PAGE_SIZE
): Promise<ChatMessage[]> {
  const snap = await getDocs(
    query(
      collection(db, "chat_rooms", roomId, "messages"),
      where("createdAt", "<", Timestamp.fromDate(before)),
      orderBy("createdAt", "desc"),
      limit(pageSize)
    )
  );
  return snap.docs.map((d) => toChatMessage(d.id, d.data())).reverse();
}

export interface SendDirectMessageInput {
  roomId: string;
  senderId: string;
  senderName: string;
  text: string;
  peerUid: string;
  peerName: string;
}

// Lazily creates the room doc on first send (check-then-create, matching
// chat.dart's _roomCreated guard) rather than upserting the static fields on
// every send — re-writing createdByUid/createdByName/sendTo from whichever
// side just sent would scramble which participant's "point of view" those
// cached fields represent.
export async function sendDirectMessage(input: SendDirectMessageInput): Promise<void> {
  const roomRef = doc(db, "chat_rooms", input.roomId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) {
    await setDoc(roomRef, {
      gigId: "",
      isGigChat: true,
      participants: [input.senderId, input.peerUid],
      sendTo: input.peerName,
      createdByUid: input.senderId,
      createdByName: input.senderName,
      subject: "Gig Chat",
      status: "open",
      lastMessage: "",
      lastMessageSender: "",
      lastMessageSenderId: "",
      lastMessageAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  }

  await addDoc(collection(db, "chat_rooms", input.roomId, "messages"), {
    senderId: input.senderId,
    isSupport: false,
    name: input.senderName,
    text: input.text,
    hasSeen: false,
    hasSeenByAdmin: false,
    hasSeenByPeer: false,
    isAutoReply: false,
    isDeleted: false,
    createdAt: serverTimestamp(),
  });

  await updateDoc(roomRef, {
    lastMessage: input.text,
    lastMessageSender: "You",
    lastMessageSenderId: input.senderId,
    lastMessageAt: serverTimestamp(),
  });
}

// Unread is derived live (no stored counter), matching home_chat.dart's
// _unreadStream: any message from the other participant not yet seen.
export function subscribeRoomUnread(roomId: string, otherUid: string, onData: (hasUnread: boolean) => void): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, "chat_rooms", roomId, "messages"),
      where("senderId", "==", otherUid),
      where("hasSeen", "==", false)
    ),
    (snap) => onData(!snap.empty),
    () => onData(false)
  );
}

// Sidebar-wide unread count — same per-room subscription home_chat.dart uses
// for its badge dot (a Map<roomId, bool> kept live, see _listenForUnread),
// except aggregated as a count of unread conversations rather than a single
// "any unread" boolean.
export function subscribeUnreadRoomsCount(uid: string, onData: (count: number) => void): Unsubscribe {
  const roomUnsubs = new Map<string, Unsubscribe>();
  const unreadByRoom = new Map<string, boolean>();

  function recompute() {
    onData([...unreadByRoom.values()].filter(Boolean).length);
  }

  const unsubscribeRooms = onSnapshot(
    query(collection(db, "chat_rooms"), where("participants", "array-contains", uid)),
    (snap) => {
      const currentIds = new Set(snap.docs.map((d) => d.id));

      roomUnsubs.forEach((unsub, roomId) => {
        if (currentIds.has(roomId)) return;
        unsub();
        roomUnsubs.delete(roomId);
        unreadByRoom.delete(roomId);
      });

      snap.docs.forEach((d) => {
        if (roomUnsubs.has(d.id)) return;
        const otherUid = otherParticipant(toChatRoom(d.id, d.data()), uid);
        if (!otherUid) return;
        roomUnsubs.set(
          d.id,
          subscribeRoomUnread(d.id, otherUid, (hasUnread) => {
            unreadByRoom.set(d.id, hasUnread);
            recompute();
          })
        );
      });

      recompute();
    },
    () => onData(0)
  );

  return () => {
    unsubscribeRooms();
    roomUnsubs.forEach((unsub) => unsub());
  };
}

// Mirrors chat.dart's _markSupportMessagesAsSeen: `hasSeen` (drives the chat
// list's unread indicator) and `hasSeenByPeer` (drives the sender's "seen"
// checkmark, see subscribeMessages/ChatMessage) are tracked separately, so
// both need marking on the peer's messages when this thread is opened.
export async function markRoomMessagesSeen(roomId: string, otherUid: string): Promise<void> {
  const messagesRef = collection(db, "chat_rooms", roomId, "messages");
  const [unseenSnap, unseenByPeerSnap] = await Promise.all([
    getDocs(query(messagesRef, where("senderId", "==", otherUid), where("hasSeen", "==", false))),
    getDocs(query(messagesRef, where("senderId", "==", otherUid), where("hasSeenByPeer", "==", false))),
  ]);
  if (unseenSnap.empty && unseenByPeerSnap.empty) return;
  const batch = writeBatch(db);
  unseenSnap.docs.forEach((d) => batch.update(d.ref, { hasSeen: true }));
  unseenByPeerSnap.docs.forEach((d) => batch.update(d.ref, { hasSeenByPeer: true }));
  await batch.commit();
}

// Soft-delete — flips `isDeleted` rather than removing the doc, so the
// thread's message order/count and any hasSeen bookkeeping on it stay
// intact. The client (ChatPage.tsx) renders an isDeleted message as
// "Message has been removed" instead of its `text`.
export async function deleteMessage(roomId: string, messageId: string): Promise<void> {
  await updateDoc(doc(db, "chat_rooms", roomId, "messages", messageId), { isDeleted: true });
}
