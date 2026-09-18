"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Lock,
  QrCode,
  ShieldCheck,
  ShieldOff,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import TitlePage from "@/components/TitlePage";
import JoshDiv from "@/components/DivAnimation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppSelector } from "@/store/hooks";
import {
  fetchReferredPeople,
  milestoneProgress,
  REFERRAL_MILESTONES,
  TOTAL_REFERRAL_LEVELS,
  type ReferredPerson,
} from "@/lib/referrals";

// Mirrors giggre_app/lib/screens/referrals/my_referral_screen.dart's 3-tab
// screen exactly (Referral Code / My Referrals / Roadmap) — that screen has
// no role branching at all (same widget for host and worker), so this is
// shared between /app/host/referrals and /app/worker/referrals too, with
// `role` only picking which brand color it's tinted with (same convention as
// ReferralsCard).
const AVATAR_COLORS = ["#2164F3", "#7C3AED", "#0891B2", "#059669", "#D97706", "#DC2626"];
function avatarColor(name: string) {
  const code = name.trim().charCodeAt(0) || 0;
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

function formatDate(date: Date | null) {
  if (!date) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function VerificationChip({ status }: { status: string }) {
  if (status === "verified") {
    return (
      <Badge className="gap-1 bg-(--success-tint) text-(--success-text)">
        <ShieldCheck className="size-3" />
        Verified
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge className="gap-1 bg-(--quick-tint) text-(--quick-text)">
        <Clock className="size-3" />
        Pending
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <ShieldOff className="size-3" />
      Unverified
    </Badge>
  );
}

export default function ReferralsPage({ role }: { role: "host" | "worker" }) {
  const uid = useAppSelector((root) => root.user.authUser?.uid);
  const referrals = useAppSelector((root) => root.user.profile?.referrals);

  const code = referrals?.referral_code ?? "";
  const level = referrals?.referral_level ?? 0;
  const referralsCount = referrals?.referrals_count ?? 0;
  const verifiedCount = referrals?.verified_referrals ?? 0;
  const progress = milestoneProgress(referralsCount);

  const gradient =
    role === "host"
      ? "linear-gradient(135deg, var(--host-start), var(--host-end))"
      : "linear-gradient(135deg, var(--worker-start), var(--worker-end))";
  const tintClass = role === "host" ? "bg-host-tint" : "bg-worker-tint";
  const textClass = role === "host" ? "text-(--host-text)" : "text-(--worker-text)";
  // --on-host/--on-worker are the fixed foreground colors for content sitting
  // directly on the host/worker gradient fills (see globals.css) — host-start
  // is a bright yellow, so plain text-white there is unreadable.
  const heroTextClass = role === "host" ? "text-(--on-host)" : "text-(--on-worker)";
  const heroTextSoftClass = role === "host" ? "text-(--on-host)/70" : "text-(--on-worker)/80";
  const activeTabClass =
    role === "host"
      ? "gap-1.5 data-active:bg-(--host-end) data-active:text-white"
      : "gap-1.5 data-active:bg-(--worker-end) data-active:text-white";

  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Referral code copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy referral code:", err);
      toast.error("Couldn't copy code. Please try again.");
    }
  }

  // Lazy-loaded the first time the "My Referrals" tab is opened, rather than
  // up front — avoids the N follow-up isVerified reads (see fetchReferredPeople)
  // for visitors who never leave the Referral Code tab.
  const [people, setPeople] = useState<ReferredPerson[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const peopleLoadedRef = useRef(false);

  async function loadPeople(uidToLoad: string) {
    setPeopleLoading(true);
    try {
      const result = await fetchReferredPeople(uidToLoad);
      setPeople(result.people);
      setCursor(result.cursor);
      setHasMore(result.hasMore);
    } catch (err) {
      console.error("Failed to load referrals:", err);
      toast.error("Couldn't load your referrals. Please try again.");
    } finally {
      setPeopleLoading(false);
    }
  }

  async function handleLoadMore() {
    if (!uid || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await fetchReferredPeople(uid, cursor);
      setPeople((prev) => [...prev, ...result.people]);
      setCursor(result.cursor);
      setHasMore(result.hasMore);
    } catch (err) {
      console.error("Failed to load more referrals:", err);
      toast.error("Couldn't load more referrals. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  function handleTabChange(value: string) {
    if (value === "people" && uid && !peopleLoadedRef.current) {
      peopleLoadedRef.current = true;
      loadPeople(uid);
    }
  }

  const nextMilestoneIndex = REFERRAL_MILESTONES.findIndex((m) => referralsCount < m.referrals);

  return (
    <JoshDiv>
      <TitlePage title="My Referrals" description="Invite friends and track your referral progress" />

      <Tabs defaultValue="code" onValueChange={handleTabChange} className="mt-6">
        <TabsList className="bg-secondary">
          <TabsTrigger value="code" className={activeTabClass}>
            Referral Code
          </TabsTrigger>
          <TabsTrigger value="people" className={activeTabClass}>
            My Referrals
          </TabsTrigger>
          <TabsTrigger value="roadmap" className={activeTabClass}>
            Roadmap
          </TabsTrigger>
        </TabsList>

        <TabsContent value="code" className="mt-4 space-y-4">
          <div className={`rounded-2xl p-6 ${heroTextClass}`} style={{ background: gradient }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-bold">{progress.label ?? "Not started yet"}</p>
                <p className={`mt-0.5 text-sm ${heroTextSoftClass}`}>
                  {referralsCount} referral{referralsCount === 1 ? "" : "s"} total
                </p>
              </div>
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
                L{level}
              </div>
            </div>

            {progress.maxed ? (
              <p className="mt-4 text-sm font-medium">🎉 You&apos;ve unlocked all milestones!</p>
            ) : (
              <div className="mt-4">
                <div className={`flex items-center justify-between text-xs ${heroTextSoftClass}`}>
                  <span>Progress to next level</span>
                  <span>{Math.round(progress.progress * 100)}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full rounded-full bg-white" style={{ width: `${progress.progress * 100}%` }} />
                </div>
                <p className={`mt-2 text-xs ${heroTextSoftClass}`}>
                  {progress.remaining} more referral{progress.remaining === 1 ? "" : "s"} to unlock {progress.nextLabel}
                </p>
              </div>
            )}
          </div>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <div className={`flex size-8 items-center justify-center rounded-lg ${tintClass} ${textClass}`}>
                <Copy className="size-4" />
              </div>
              <p className="font-medium text-ink">Your Referral Code</p>
            </div>
            <div className={`mt-3 flex items-center justify-between gap-3 rounded-lg border border-dashed border-hairline ${tintClass} px-4 py-3`}>
              <span className={`font-mono text-lg font-bold tracking-[0.3em] ${textClass}`}>{code || "—"}</span>
              <Button
                size="icon-sm"
                onClick={handleCopy}
                disabled={!code}
                className={copied ? "bg-(--success-start) text-white" : `${tintClass} ${textClass}`}
                aria-label="Copy referral code"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted">Share this code with friends to earn referral rewards.</p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <div className={`flex size-8 items-center justify-center rounded-lg ${tintClass} ${textClass}`}>
                <QrCode className="size-4" />
              </div>
              <p className="font-medium text-ink">Scan to Share</p>
            </div>
            <div className="mt-3 flex justify-center">
              {code ? (
                <div className="rounded-xl bg-white p-4">
                  <QRCodeSVG value={code} size={160} />
                </div>
              ) : (
                <p className="py-8 text-sm text-muted">No referral code available.</p>
              )}
            </div>
            <p className="mt-2 text-center text-xs text-muted">Ask friends to scan this to use your referral code.</p>
          </Card>
        </TabsContent>

        <TabsContent value="people" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Card className="flex flex-row items-center gap-3 p-4">
              <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tintClass} ${textClass}`}>
                <Users className="size-4" />
              </div>
              <div>
                <p className="text-lg font-bold text-ink">{referralsCount}</p>
                <p className="text-xs text-muted">Total Referred</p>
              </div>
            </Card>
            <Card className="flex flex-row items-center gap-3 p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--success-tint) text-(--success-text)">
                <ShieldCheck className="size-4" />
              </div>
              <div>
                <p className="text-lg font-bold text-ink">{verifiedCount}</p>
                <p className="text-xs text-muted">Verified</p>
              </div>
            </Card>
          </div>

          {peopleLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : people.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 p-10 text-center">
              <UserPlus className="size-8 text-muted" />
              <p className="text-sm font-medium text-ink">No referrals yet</p>
              <p className="text-xs text-muted">Share your referral code with friends and they&apos;ll appear here once they join.</p>
            </Card>
          ) : (
            <>
              <p className="text-xs font-medium tracking-wide text-muted uppercase">Recently joined</p>
              <div className="space-y-2">
                {people.map((person) => (
                  <Card key={person.uid} className="flex flex-row items-center gap-3 p-3">
                    <Avatar className="size-10 shrink-0">
                      <AvatarFallback style={{ backgroundColor: avatarColor(person.name), color: "white" }}>
                        {initials(person.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{person.name.trim().split(" ")[0] || "Unknown"}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <VerificationChip status={person.isVerified} />
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 text-xs text-muted">
                      <Calendar className="size-3.5" />
                      {formatDate(person.joinedAt)}
                    </div>
                  </Card>
                ))}
              </div>
              {hasMore && (
                <Button variant="outline" className="w-full" onClick={handleLoadMore} disabled={loadingMore}>
                  {loadingMore ? "Loading…" : "Load more"}
                </Button>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="roadmap" className="mt-4 space-y-4">
          <div className={`rounded-2xl p-6 ${heroTextClass}`} style={{ background: gradient }}>
            <p className="text-lg font-bold">{progress.maxed ? "🐐 Legendary GOAT" : (progress.label ?? "Not started yet")}</p>
            <p className={`mt-0.5 text-sm ${heroTextSoftClass}`}>
              Level {level} of {TOTAL_REFERRAL_LEVELS}
            </p>
            {!progress.maxed && (
              <>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full rounded-full bg-white" style={{ width: `${progress.progress * 100}%` }} />
                </div>
                <p className={`mt-2 text-xs ${heroTextSoftClass}`}>{progress.remaining} more referrals to next level</p>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Card className="flex flex-row items-center gap-3 p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--success-tint) text-(--success-text)">
                <Trophy className="size-4" />
              </div>
              <div>
                <p className="text-lg font-bold text-ink">
                  {level} / {TOTAL_REFERRAL_LEVELS}
                </p>
                <p className="text-xs text-muted">Unlocked</p>
              </div>
            </Card>
            <Card className="flex flex-row items-center gap-3 p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-mist text-muted">
                <Lock className="size-4" />
              </div>
              <div>
                <p className="text-lg font-bold text-ink">{TOTAL_REFERRAL_LEVELS - level}</p>
                <p className="text-xs text-muted">Remaining</p>
              </div>
            </Card>
          </div>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <div className={`flex size-8 items-center justify-center rounded-lg ${tintClass} ${textClass}`}>
                <Trophy className="size-4" />
              </div>
              <p className="font-medium text-ink">Milestones</p>
            </div>
            <div className="mt-4">
              {REFERRAL_MILESTONES.map((milestone, i) => {
                const reached = referralsCount >= milestone.referrals;
                const isNext = !reached && i === nextMilestoneIndex;
                const isLast = i === REFERRAL_MILESTONES.length - 1;
                return (
                  <div key={milestone.level} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          reached
                            ? "bg-(--success-start) text-white"
                            : isNext
                              ? `border-2 ${tintClass} ${textClass}`
                              : "border border-hairline bg-mist text-muted"
                        }`}
                        style={isNext ? { borderColor: role === "host" ? "var(--host-start)" : "var(--worker-start)" } : undefined}
                      >
                        {reached ? <Check className="size-4" /> : milestone.level}
                      </div>
                      {!isLast && <div className={`w-0.5 flex-1 ${reached ? "bg-(--success-start)" : "bg-hairline"}`} />}
                    </div>
                    <div className="min-w-0 flex-1 pb-3">
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                        <p className={`min-w-0 text-sm font-medium ${reached ? "text-(--success-text)" : isNext ? "text-ink" : "text-muted/60"}`}>
                          {milestone.label}
                        </p>
                        {reached ? (
                          <Badge className="gap-1 bg-(--success-tint) text-(--success-text)">
                            <Check className="size-3" />
                            Unlocked
                          </Badge>
                        ) : isNext ? (
                          <Badge className={`gap-1 ${tintClass} ${textClass}`}>
                            Next
                            <ChevronRight className="size-3" />
                          </Badge>
                        ) : (
                          <Lock className="size-3.5 text-muted/60" />
                        )}
                      </div>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                        <Users className="size-3" />
                        {milestone.referrals} referrals
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </JoshDiv>
  );
}
