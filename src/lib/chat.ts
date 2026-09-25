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
  GeoPoint,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { reverseGeocode } from "@/lib/post-gig";

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
  // Web-only, no giggre_app equivalent — a one-time pin sent via the
  // "Share location" composer action (sendLocationMessage below),
  // available to both host and worker. Unrelated to the continuous,
  // gig-status-gated `workerLocation` GeoPoint tracked on the gig/
  // worker-slot doc while a worker is "navigating" (see
  // WorkerTrackingMap.tsx) — different field, different collection,
  // different trigger.
  location: { lat: number; lng: number; address: string | null } | null;
  // Web-only, no giggre_app equivalent — set via sendAttachmentMessage
  // below, available to both host and worker. Storage path follows this
  // app's existing upload convention (see uploadUserDocument in
  // documents.ts): upload first, then store the resulting download URL
  // alongside the message doc rather than the storage path itself, since
  // (unlike documents) a chat attachment is never re-deleted from Storage
  // independently of the message.
  attachment: { url: string; type: AttachmentType; name: string } | null;
}

export type AttachmentType = "image" | "video" | "file";

// The live window covers the most recent messages in real time; anything
// older is fetched on demand (see fetchOlderMessages) when the thread is
// scrolled to the top, rather than chat.dart's up-front paginated history.
const MESSAGE_WINDOW = 50;
export const OLDER_MESSAGES_PAGE_SIZE = 30;

function toChatMessage(id: string, data: Record<string, unknown>): ChatMessage {
  const location = data.location as GeoPoint | undefined;
  const attachmentUrl = data.attachmentUrl as string | undefined;
  const attachmentType = data.attachmentType as AttachmentType | undefined;
  return {
    id,
    senderId: (data.senderId as string | undefined) ?? "",
    name: (data.name as string | undefined) ?? "",
    text: (data.text as string | undefined) ?? "",
    hasSeen: (data.hasSeen as boolean | undefined) ?? false,
    hasSeenByPeer: (data.hasSeenByPeer as boolean | undefined) ?? false,
    createdAt: (data.createdAt as Timestamp | undefined)?.toDate() ?? new Date(),
    isDeleted: (data.isDeleted as boolean | undefined) ?? false,
    location: location
      ? { lat: location.latitude, lng: location.longitude, address: (data.locationAddress as string | undefined) ?? null }
      : null,
    attachment:
      attachmentUrl && attachmentType
        ? { url: attachmentUrl, type: attachmentType, name: (data.attachmentName as string | undefined) ?? "" }
        : null,
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
// cached fields represent. Shared by sendDirectMessage and
// sendLocationMessage below.
async function ensureRoomExists(
  roomId: string,
  senderId: string,
  senderName: string,
  peerUid: string,
  peerName: string
): Promise<void> {
  const roomRef = doc(db, "chat_rooms", roomId);
  const roomSnap = await getDoc(roomRef);
  if (roomSnap.exists()) return;
  await setDoc(roomRef, {
    gigId: "",
    isGigChat: true,
    participants: [senderId, peerUid],
    sendTo: peerName,
    createdByUid: senderId,
    createdByName: senderName,
    subject: "Gig Chat",
    status: "open",
    lastMessage: "",
    lastMessageSender: "",
    lastMessageSenderId: "",
    lastMessageAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
}

export async function sendDirectMessage(input: SendDirectMessageInput): Promise<void> {
  await ensureRoomExists(input.roomId, input.senderId, input.senderName, input.peerUid, input.peerName);
  const roomRef = doc(db, "chat_rooms", input.roomId);

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

export interface SendLocationMessageInput {
  roomId: string;
  senderId: string;
  senderName: string;
  peerUid: string;
  peerName: string;
  lat: number;
  lng: number;
}

const LOCATION_MESSAGE_PREVIEW = "📍 Shared location";

// Web-only, no giggre_app equivalent — available to both roles in the UI
// (ChatPage.tsx). A one-time pin, distinct from the continuous `workerLocation` tracking on
// the gig doc (see the `location` field comment on ChatMessage above).
export async function sendLocationMessage(input: SendLocationMessageInput): Promise<void> {
  await ensureRoomExists(input.roomId, input.senderId, input.senderName, input.peerUid, input.peerName);
  const roomRef = doc(db, "chat_rooms", input.roomId);

  // Resolved once at send-time (same reverse-geocode used by the gig-posting
  // flow, see post-gig.ts) and stored on the message rather than re-resolved
  // on every render — cheaper, and the address a location was shared from
  // shouldn't change retroactively. `address` is null if the lookup fails;
  // the map pin itself never depends on it.
  const { address } = await reverseGeocode(input.lat, input.lng);

  await addDoc(collection(db, "chat_rooms", input.roomId, "messages"), {
    senderId: input.senderId,
    isSupport: false,
    name: input.senderName,
    text: LOCATION_MESSAGE_PREVIEW,
    location: new GeoPoint(input.lat, input.lng),
    locationAddress: address,
    hasSeen: false,
    hasSeenByAdmin: false,
    hasSeenByPeer: false,
    isAutoReply: false,
    isDeleted: false,
    createdAt: serverTimestamp(),
  });

  await updateDoc(roomRef, {
    lastMessage: LOCATION_MESSAGE_PREVIEW,
    lastMessageSender: "You",
    lastMessageSenderId: input.senderId,
    lastMessageAt: serverTimestamp(),
  });
}

// No giggre_app precedent for chat attachments specifically (build-from-
// scratch), but these caps and the extension allowlist below follow the
// only established upload precedent in the app — document/skill-request
// proof uploads (documents.ts's uploadUserDocument) — which has no byte-size
// cap at all, just an extension allowlist. Picking explicit caps here since
// "no limit" is a poor default for a chat composer; easy to tune later.
export const ATTACHMENT_MAX_BYTES: Record<AttachmentType, number> = {
  image: 10 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  file: 20 * 1024 * 1024,
};

export function attachmentTypeForFile(file: File): AttachmentType {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "file";
}

const ATTACHMENT_PREVIEW_TEXT: Record<AttachmentType, (name: string) => string> = {
  image: () => "📷 Photo",
  video: () => "🎥 Video",
  file: (name) => `📎 ${name}`,
};

export interface SendAttachmentMessageInput {
  roomId: string;
  senderId: string;
  senderName: string;
  peerUid: string;
  peerName: string;
  file: File;
}

// Web-only, no giggre_app equivalent — available to both host and worker.
// Storage path mirrors this app's existing convention (see
// uploadUserDocument in documents.ts and the Flutter skill-request-proof
// upload it was itself mirrored from): a timestamp-prefixed filename under a
// feature-scoped folder, here `chat_attachments/{roomId}/...` rather than
// `users/{uid}/documents/...`, since an attachment belongs to the
// conversation rather than to either participant individually.
export async function sendAttachmentMessage(input: SendAttachmentMessageInput): Promise<void> {
  const attachmentType = attachmentTypeForFile(input.file);
  const maxBytes = ATTACHMENT_MAX_BYTES[attachmentType];
  if (input.file.size > maxBytes) {
    throw new Error(`That file is too large — the limit is ${Math.round(maxBytes / (1024 * 1024))}MB.`);
  }

  await ensureRoomExists(input.roomId, input.senderId, input.senderName, input.peerUid, input.peerName);
  const roomRef = doc(db, "chat_rooms", input.roomId);

  const storagePath = `chat_attachments/${input.roomId}/${Date.now()}_${input.file.name}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, input.file);
  const url = await getDownloadURL(storageRef);

  const previewText = ATTACHMENT_PREVIEW_TEXT[attachmentType](input.file.name);

  await addDoc(collection(db, "chat_rooms", input.roomId, "messages"), {
    senderId: input.senderId,
    isSupport: false,
    name: input.senderName,
    text: previewText,
    attachmentUrl: url,
    attachmentType,
    attachmentName: input.file.name,
    hasSeen: false,
    hasSeenByAdmin: false,
    hasSeenByPeer: false,
    isAutoReply: false,
    isDeleted: false,
    createdAt: serverTimestamp(),
  });

  await updateDoc(roomRef, {
    lastMessage: previewText,
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
  const messagesRef = collection(db, "chat_rooms", roomId, "messages");
  await updateDoc(doc(messagesRef, messageId), { isDeleted: true });

  // If this was the room's most recent message, the chat list reads its
  // preview straight off `chat_rooms.lastMessage` (a denormalized copy)
  // rather than the message doc, so it would keep showing the removed text
  // forever unless it's refreshed here too. Mirrors giggre_app's chat.dart
  // _deleteMessage.
  const latestSnap = await getDocs(query(messagesRef, orderBy("createdAt", "desc"), limit(1)));
  if (latestSnap.docs[0]?.id === messageId) {
    await updateDoc(doc(db, "chat_rooms", roomId), { lastMessage: "Message has been removed" });
  }
}
