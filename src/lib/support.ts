import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// Mirrors giggre_app's lib/screens/app_contents/contact_us.dart
// (_generateTicketNumber / the authenticated submit path) — same
// `support_tickets` + `chat_rooms` (isSupport: true, userId instead of a
// participants array) shape, so a ticket/thread created here is readable and
// answerable from the existing giggre-admin support inbox unmodified. The
// message subcollection itself is the same one chat.ts already reads/writes
// (see subscribeMessages/fetchOlderMessages/ChatMessage, re-exported below) —
// only the room-level shape differs from peer-to-peer chat.
export { subscribeMessages, fetchOlderMessages, type ChatMessage } from "@/lib/chat";

type ActionResult = { ok: true } | { ok: false; reason: string };
type SubmitTicketResult = { ok: true; roomId: string } | { ok: false; reason: string };

const SUPPORT_SENDER_ID = "support";
const SUPPORT_NAME = "Giggre Support";
const AUTO_REPLY_SETTINGS_DOC = "qGDefSx1JYdx86VxlznN";
const DEFAULT_AUTO_REPLY = "Thank you for contacting us! We'll get back to you shortly.";

export type TicketStatus = "open" | "in progress" | "resolved";

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  roomId: string;
  subject: string;
  status: TicketStatus;
  lastMessage: string;
  lastMessageAt: Date | null;
  createdAt: Date | null;
}

function toSupportTicket(id: string, data: Record<string, unknown>): SupportTicket {
  return {
    id,
    ticketNumber: (data.ticket_number as string | undefined) ?? "",
    roomId: (data.roomId as string | undefined) ?? "",
    subject: (data.subject as string | undefined) ?? "",
    status: ((data.status as TicketStatus | undefined) ?? "open"),
    lastMessage: (data.message as string | undefined) ?? "",
    lastMessageAt: null,
    createdAt: (data.createdAt as Timestamp | undefined)?.toDate() ?? null,
  };
}

/** `TKT-2026-000123` — a transactional per-year counter, same format/doc as giggre-admin's generateTicketNumber.ts. */
async function generateTicketNumber(): Promise<string> {
  const counterRef = doc(db, "_counters", "support_tickets");
  const year = new Date().getFullYear();

  const count = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = (snap.data()?.[`count_${year}`] as number | undefined) ?? 0;
    const next = current + 1;
    tx.set(counterRef, { [`count_${year}`]: next }, { merge: true });
    return next;
  });

  return `TKT-${year}-${String(count).padStart(6, "0")}`;
}

// Fire-and-forget continuation of submitSupportTicket below — the 2s delay
// before an auto-reply (matching contact_us.dart's own Future.delayed) has no
// reason to hold up the ticket-submitted response the UI is waiting on; the
// reply lands a couple seconds later via whichever subscribeMessages
// listener is open on this room.
async function sendAutoReplyAfterDelay(roomId: string, autoReplyMessage: string): Promise<void> {
  try {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await addDoc(collection(db, "chat_rooms", roomId, "messages"), {
      senderId: SUPPORT_SENDER_ID,
      isSupport: true,
      name: SUPPORT_NAME,
      text: autoReplyMessage,
      hasSeen: false,
      hasSeenByAdmin: true,
      createdAt: serverTimestamp(),
      isAutoReply: true,
    });
    await updateDoc(doc(db, "chat_rooms", roomId), {
      lastMessage: autoReplyMessage,
      lastMessageSender: "Support",
      lastMessageAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Failed to send support auto-reply:", err);
  }
}

export async function submitSupportTicket(
  uid: string,
  name: string,
  email: string,
  subject: string,
  message: string
): Promise<SubmitTicketResult> {
  try {
    const ticketNumber = await generateTicketNumber();
    const roomRef = doc(collection(db, "chat_rooms"));

    await addDoc(collection(db, "support_tickets"), {
      source: "user",
      ticket_number: ticketNumber,
      userId: uid,
      name,
      email,
      subject,
      message,
      roomId: roomRef.id,
      status: "open",
      hasRead: false,
      createdAt: serverTimestamp(),
      recipientType: null,
      recipients: [],
      createdBy: null,
    });

    await setDoc(roomRef, {
      userId: uid,
      name,
      subject,
      sendTo: SUPPORT_NAME,
      status: "open",
      isSupport: true,
      ticketId: null,
      lastMessage: message,
      lastMessageSender: "You",
      lastMessageAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });

    const autoReplySnap = await getDoc(doc(db, "support_settings", AUTO_REPLY_SETTINGS_DOC));
    const autoReplyData = autoReplySnap.data();
    const autoReplyEnabled = (autoReplyData?.enabled_auto_reply as boolean | undefined) ?? false;

    await addDoc(collection(db, "chat_rooms", roomRef.id, "messages"), {
      senderId: uid,
      isSupport: false,
      name,
      text: message,
      hasSeen: true,
      hasSeenByAdmin: autoReplyEnabled,
      createdAt: serverTimestamp(),
      isAutoReply: false,
    });

    if (autoReplyEnabled) {
      const autoReplyMessage = (autoReplyData?.auto_reply_message as string | undefined) || DEFAULT_AUTO_REPLY;
      void sendAutoReplyAfterDelay(roomRef.id, autoReplyMessage);
    }

    return { ok: true, roomId: roomRef.id };
  } catch (err) {
    console.error("Failed to submit support ticket:", err);
    return { ok: false, reason: "Couldn't submit your message. Please try again." };
  }
}

export function subscribeSupportTickets(
  uid: string,
  onData: (tickets: SupportTicket[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "support_tickets"), where("userId", "==", uid), orderBy("createdAt", "desc")),
    (snap) => onData(snap.docs.map((d) => toSupportTicket(d.id, d.data()))),
    onError
  );
}

export async function sendSupportReply(roomId: string, uid: string, name: string, text: string): Promise<ActionResult> {
  try {
    await addDoc(collection(db, "chat_rooms", roomId, "messages"), {
      senderId: uid,
      isSupport: false,
      name,
      text,
      hasSeen: true,
      hasSeenByAdmin: false,
      createdAt: serverTimestamp(),
      isAutoReply: false,
    });
    await updateDoc(doc(db, "chat_rooms", roomId), {
      lastMessage: text,
      lastMessageSender: "You",
      lastMessageAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (err) {
    console.error("Failed to send support reply:", err);
    return { ok: false, reason: "Couldn't send your message. Please try again." };
  }
}

// Sidebar badge — same "live per-room unread subscription, aggregated" shape
// as subscribeUnreadRoomsCount in chat.ts, but keyed off `userId` (the
// support-room shape) instead of `participants array-contains`, and counting
// unseen messages from "support" specifically rather than from a peer uid.
export function subscribeSupportUnreadCount(uid: string, onData: (count: number) => void): Unsubscribe {
  const roomUnsubs = new Map<string, Unsubscribe>();
  const unreadByRoom = new Map<string, boolean>();

  function recompute() {
    onData([...unreadByRoom.values()].filter(Boolean).length);
  }

  const unsubscribeRooms = onSnapshot(
    query(collection(db, "chat_rooms"), where("userId", "==", uid), where("isSupport", "==", true)),
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
        const roomId = d.id;
        roomUnsubs.set(
          roomId,
          onSnapshot(
            query(
              collection(db, "chat_rooms", roomId, "messages"),
              where("senderId", "==", SUPPORT_SENDER_ID),
              where("hasSeen", "==", false)
            ),
            (msgSnap) => {
              unreadByRoom.set(roomId, !msgSnap.empty);
              recompute();
            },
            () => {
              unreadByRoom.set(roomId, false);
              recompute();
            }
          )
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

// Marks support's messages in this thread as seen — called when the thread
// is opened, same convention as markRoomMessagesSeen in chat.ts.
export async function markSupportThreadSeen(roomId: string): Promise<void> {
  const messagesRef = collection(db, "chat_rooms", roomId, "messages");
  const unseenSnap = await getDocs(
    query(messagesRef, where("senderId", "==", SUPPORT_SENDER_ID), where("hasSeen", "==", false))
  );
  if (unseenSnap.empty) return;
  await Promise.all(unseenSnap.docs.map((d) => updateDoc(d.ref, { hasSeen: true })));
}
