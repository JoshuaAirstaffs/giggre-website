"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LifeBuoy, Loader2, Send } from "lucide-react";
import TitlePage from "@/components/TitlePage";
import JoshDiv from "@/components/DivAnimation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Message, MessageAvatar, MessageContent, MessageFooter } from "@/components/ui/message";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAppSelector } from "@/store/hooks";
import { cn } from "@/lib/utils";
import { formatPostedAge } from "@/lib/gig-format";
import {
  markSupportThreadSeen,
  sendSupportReply,
  subscribeMessages,
  subscribeSupportTickets,
  submitSupportTicket,
  type ChatMessage,
  type SupportTicket,
  type TicketStatus,
} from "@/lib/support";

// Mirrors giggre_app's lib/screens/app_contents/contact_us.dart — a ticket
// form plus a live two-way thread with "Giggre Support", reusing the same
// `chat_rooms`/messages shape the existing giggre-admin support inbox
// already reads/replies to (see support.ts). Shared between
// /app/host/support and /app/worker/support, same pattern as
// DocumentsPage/VerificationPage — support is one account-wide concern, not
// role-specific.

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

function timeLabel(date: Date | null) {
  if (!date) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// Admin replies are composed in a rich-text editor in giggre-admin and
// stored as raw HTML — mirrors chat.dart's own `_isHtml` detection
// (`text.contains('<') && text.contains('>')`). Rather than rendering that
// HTML directly (dangerouslySetInnerHTML on admin-authored content neither
// Firestore rules nor this app currently constrain to a safe-tag allowlist),
// this converts block-level tags to line breaks and decodes a few common
// entities, so "Hello,<div>...</div>" reads as plain, readable lines instead
// of showing the literal tags.
function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(div|p)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function messageText(text: string): string {
  return text.includes("<") && text.includes(">") ? htmlToPlainText(text) : text;
}

const STATUS_BADGE_CLASSES: Record<TicketStatus, string> = {
  open: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  "in progress": "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  resolved: "bg-(--success-tint) text-(--success-text)",
};

function StatusBadge({ status }: { status: TicketStatus }) {
  return <Badge className={STATUS_BADGE_CLASSES[status]}>{status}</Badge>;
}

// A plain <img> + local load-state, rather than the ui/avatar primitives'
// own Image/Fallback swap — which only showed initials reliably once there
// was never a photo at all, not once a photo URL failed to load inside this
// message-list layout. Exactly one of {image, fallback} renders at a time,
// driven entirely by this component's own state instead of library internals.
function MessageSenderAvatar({ mine, photoUrl, senderName }: { mine: boolean; photoUrl?: string; senderName: string }) {
  const [imageOk, setImageOk] = useState(true);
  const showImage = mine && !!photoUrl && imageOk;
  return (
    <Avatar className="size-8">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- external Firebase Storage/Google photo URL, not a static asset
        <img
          src={photoUrl}
          alt={senderName}
          className="aspect-square size-full rounded-full object-cover"
          onError={() => setImageOk(false)}
        />
      ) : (
        <AvatarFallback className={mine ? "bg-worker text-white" : "bg-amber-500/10 text-amber-700"}>
          {mine ? initials(senderName) : <LifeBuoy className="size-3.5" />}
        </AvatarFallback>
      )}
    </Avatar>
  );
}

export default function SupportPage() {
  const { authUser, profile } = useAppSelector((root) => root.user);
  const uid = authUser?.uid;
  const myDisplayName = profile?.name ?? authUser?.displayName ?? "You";

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoaded, setTicketsLoaded] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!name && profile?.name) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time prefill once the profile loads
      setName(profile.name);
    }
  }, [profile?.name, name]);

  useEffect(() => {
    const prefillEmail = profile?.email ?? authUser?.email ?? "";
    if (!email && prefillEmail) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time prefill once the profile/auth user loads
      setEmail(prefillEmail);
    }
  }, [profile?.email, authUser?.email, email]);

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = subscribeSupportTickets(
      uid,
      (data) => {
        setTickets(data);
        setTicketsLoaded(true);
      },
      (err) => {
        console.error("Failed to load support tickets:", err);
        setTicketsLoaded(true);
      }
    );
    return unsubscribe;
  }, [uid]);

  useEffect(() => {
    if (!selectedRoomId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting for the "new message" form, not reacting to its own value
      setMessages([]);
      return;
    }
    setMessagesLoading(true);
    const unsubscribe = subscribeMessages(
      selectedRoomId,
      (data) => {
        setMessages(data);
        setMessagesLoading(false);
      },
      (err) => {
        console.error("Failed to load support messages:", err);
        setMessagesLoading(false);
      }
    );
    markSupportThreadSeen(selectedRoomId).catch((err) => console.error("Failed to mark support thread seen:", err));
    return unsubscribe;
  }, [selectedRoomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const selectedTicket = tickets.find((t) => t.roomId === selectedRoomId) ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!uid || submitting) return;
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      toast.error("Please fill in all required fields before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitSupportTicket(uid, name.trim(), email.trim(), subject.trim(), message.trim());
      if (result.ok) {
        toast.success("We've received your message and will respond within 24–48 hours.");
        setSubject("");
        setMessage("");
        setSelectedRoomId(result.roomId);
      } else {
        toast.error(result.reason);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReply() {
    if (!uid || !selectedRoomId || !replyText.trim() || sending) return;
    setSending(true);
    try {
      const result = await sendSupportReply(selectedRoomId, uid, myDisplayName, replyText.trim());
      if (result.ok) setReplyText("");
      else toast.error(result.reason);
    } finally {
      setSending(false);
    }
  }

  return (
    <JoshDiv>
      <TitlePage title="Help & Support" description="Message Giggre's support team — we usually reply within 24–48 hours" />

      <div className="mt-6 grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <Button className="w-full" onClick={() => setSelectedRoomId(null)}>
            New Message
          </Button>

          {!ticketsLoaded ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <p className="px-1 text-xs text-muted">No tickets yet — send a message to start one.</p>
          ) : (
            <div className="space-y-2">
              {tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setSelectedRoomId(ticket.roomId)}
                  className="block w-full text-left"
                >
                  <Card
                    className={cn(
                      "gap-1.5 p-3",
                      ticket.roomId === selectedRoomId && "border-ink/40 bg-accent"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-mono text-muted">{ticket.ticketNumber}</span>
                      <StatusBadge status={ticket.status} />
                    </div>
                    <p className="truncate text-sm font-medium text-ink">{ticket.subject}</p>
                    <p className="truncate text-xs text-muted">{ticket.lastMessage}</p>
                    <p className="text-[11px] text-muted">{formatPostedAge(ticket.createdAt)}</p>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </div>

        <Card className="flex h-[70vh] flex-col overflow-hidden p-0">
          {!selectedRoomId ? (
            <form onSubmit={handleSubmit} className="flex h-full flex-col gap-4 overflow-y-auto p-6">
              <div className="flex items-center gap-2 text-ink">
                <LifeBuoy className="size-5" />
                <p className="font-medium">Send Message</p>
              </div>

              <div>
                <Label htmlFor="support-name">Name</Label>
                <Input id="support-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="support-email">Email</Label>
                <Input id="support-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="support-subject">Subject</Label>
                <Input id="support-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Enter your subject" className="mt-1.5" />
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                <Label htmlFor="support-message">Message</Label>
                <Textarea
                  id="support-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter your message"
                  className="mt-1.5 min-h-32 flex-1"
                />
              </div>

              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                {submitting ? "Sending…" : "Send"}
              </Button>
            </form>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-hairline p-4">
                <Avatar className="size-9 bg-amber-500/10 text-amber-700">
                  <AvatarFallback className="bg-transparent">
                    <LifeBuoy className="size-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">Giggre Support</p>
                  <p className="truncate text-xs text-muted">{selectedTicket?.subject || "We'll respond within 24–48 hours"}</p>
                </div>
                {selectedTicket && <StatusBadge status={selectedTicket.status} />}
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                {messagesLoading ? (
                  <Skeleton className="h-10 w-2/3" />
                ) : messages.length === 0 ? (
                  <p className="text-center text-xs text-muted">No messages yet.</p>
                ) : (
                  messages.map((msg) => {
                    const mine = msg.senderId === uid;
                    const senderName = mine ? myDisplayName : "Giggre Support";
                    return (
                      <Message key={msg.id} align={mine ? "end" : "start"}>
                        <MessageAvatar>
                          <MessageSenderAvatar mine={mine} photoUrl={profile?.photoUrl} senderName={senderName} />
                        </MessageAvatar>
                        <MessageContent>
                          <div
                            className={cn(
                              "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                              mine ? "self-end bg-worker text-white" : "self-start border border-hairline bg-card text-ink"
                            )}
                          >
                            <p className="whitespace-pre-line">{messageText(msg.text)}</p>
                          </div>
                          <MessageFooter className={cn("gap-1 text-muted", mine && "justify-end")}>
                            <span>{timeLabel(msg.createdAt)}</span>
                          </MessageFooter>
                        </MessageContent>
                      </Message>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitReply();
                }}
                className="flex items-center gap-2 border-t border-hairline p-3"
              >
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitReply();
                    }
                  }}
                  placeholder="Type a message…"
                  className="min-h-10 flex-1 resize-none"
                  rows={1}
                />
                <Button type="submit" size="icon" disabled={!replyText.trim() || sending} aria-label="Send">
                  {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </JoshDiv>
  );
}
