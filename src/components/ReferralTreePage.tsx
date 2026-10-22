"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, RefreshCw, ShieldCheck, User as UserIcon, Users, X } from "lucide-react";
import TitlePage from "@/components/TitlePage";
import JoshDiv from "@/components/DivAnimation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, currencySymbol } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { getMyReferralTree, type ReferralTreeEarnings, type ReferralTreeResult } from "@/lib/firebase-functions";
import { AUTO_OPEN_DEPTH, buildReferralTree, countDescendants, formatJoinDate, levelName, type TreeNode } from "@/lib/referral-tree";

// Mirrors giggre_app's referral_tree_screen.dart — everyone who joined
// through the signed-in user, and who they invited in turn, plus what that
// network has earned them. Built server-side by the getMyReferralTree
// callable (a user can only read their own referrals_list in Firestore), so
// this page is purely a renderer of what that function returns.

function money(n: number): string {
  return `${currencySymbol("PHP")}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const LEVEL_CHIP_CLASS = [
  "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  "border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-400",
  "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
];

function LevelChip({ depth }: { depth: number }) {
  const className = LEVEL_CHIP_CLASS[depth - 1] ?? "border-hairline bg-secondary text-muted";
  return <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-bold", className)}>L{depth}</span>;
}

function GigBadge({ done }: { done: boolean }) {
  return (
    <Tooltip>
      {/* render as a span, not the default button — this sits inside
          NodeRow's own clickable <button>, and a button can't nest one */}
      <TooltipTrigger
        render={<span tabIndex={0} />}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full",
          done ? "bg-(--success-tint) text-(--success-text)" : "bg-destructive/10 text-destructive"
        )}
      >
        {done ? <ShieldCheck className="size-3" /> : <X className="size-3" />}
      </TooltipTrigger>
      <TooltipContent>{done ? "Completed at least 1 gig" : "No completed gigs yet"}</TooltipContent>
    </Tooltip>
  );
}

function PersonAvatar({ verified }: { verified: boolean }) {
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full",
        verified ? "bg-blue-500/12 text-blue-600" : "bg-secondary text-muted"
      )}
    >
      {verified ? <ShieldCheck className="size-3.5" /> : <UserIcon className="size-3.5" />}
    </span>
  );
}

function LimitBar({ earned, max, reachedLabel }: { earned: number; max: number; reachedLabel: string }) {
  const reached = earned >= max;
  const color = reached ? "text-amber-600 dark:text-amber-400" : "text-(--success-text)";
  const barColor = reached ? "bg-amber-500" : "bg-(--success-start)";
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className={cn("font-bold", color)}>{reached ? reachedLabel : `${money(max - earned)} left`}</span>
        <span className="text-muted">of {money(max)}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-secondary">
        <div className={cn("h-full rounded-full", barColor)} style={{ width: `${Math.min(1, max > 0 ? earned / max : 0) * 100}%` }} />
      </div>
    </div>
  );
}

function EarningsCard({ earnings }: { earnings: ReferralTreeEarnings | null }) {
  const notes = [
    earnings?.levels.some((l) => l.capped) && "Levels that hit their limit stop earning more.",
    earnings?.totalCapped && `Your total is capped at ${money(earnings.totalMax)}.`,
    earnings && earnings.deeperPeople > 0 &&
      `${earnings.deeperPeople} ${earnings.deeperPeople === 1 ? "person" : "people"} deeper than ${levelName(earnings.levels.length - 1)} earn nothing.`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Card className="p-5">
      <p className="font-medium text-ink">Referral earnings</p>
      {!earnings ? (
        <p className="mt-3 text-sm text-muted">Referral rates haven&apos;t been set up yet.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {earnings.levels.map((level) => (
            <div key={level.label} className="space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{level.label}</p>
                  <p className="text-xs text-muted">{money(level.rate)} per referral with a completed gig</p>
                </div>
                <span className="shrink-0 text-sm font-bold text-(--success-text)">{money(level.earned)}</span>
              </div>
              {level.promoActive && (
                <Badge className="border border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400">
                  {level.promoUntilMs != null ? `Promo until ${formatJoinDate(level.promoUntilMs)}` : "Promo"}
                </Badge>
              )}
              {level.maxEarn > 0 && <LimitBar earned={level.earned} max={level.maxEarn} reachedLabel="Limit reached" />}
            </div>
          ))}
          <div className="border-t border-hairline pt-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-ink">Total</p>
              <p className="text-base font-bold text-(--success-text)">{money(earnings.total)}</p>
            </div>
            {earnings.totalMax > 0 && (
              <div className="mt-2">
                <LimitBar earned={earnings.total} max={earnings.totalMax} reachedLabel="Total limit reached" />
              </div>
            )}
          </div>
          {notes && <p className="text-xs text-muted">{notes}</p>}
        </div>
      )}
    </Card>
  );
}

function NodeRow({
  node,
  isOpen,
  toggle,
}: {
  node: TreeNode;
  isOpen: (n: TreeNode) => boolean;
  toggle: (uid: string) => void;
}) {
  const open = isOpen(node);
  const hasChildren = node.children.length > 0;
  const date = formatJoinDate(node.joinedMs);
  return (
    <div>
      <button
        type="button"
        onClick={hasChildren ? () => toggle(node.uid) : undefined}
        className={cn("flex w-full items-center gap-2 rounded-lg py-1.5 text-left", hasChildren && "hover:bg-accent")}
      >
        <span className="flex size-5 shrink-0 items-center justify-center">
          {hasChildren && (
            <ChevronRight className={cn("size-3.5 text-muted transition-transform", open && "rotate-90")} />
          )}
        </span>
        <PersonAvatar verified={node.isVerified} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{node.name}</span>
          {(date || hasChildren) && (
            <span className="block truncate text-[10.5px] text-muted">
              {[date && `Joined ${date}`, hasChildren && `${countDescendants(node)} below`].filter(Boolean).join(" · ")}
            </span>
          )}
        </span>
        <LevelChip depth={node.depth} />
        <GigBadge done={node.gigDone} />
      </button>
      {hasChildren && open && (
        <div className="ml-2.5 border-l border-hairline pl-2.5">
          {node.children.map((child) => (
            <NodeRow key={child.uid} node={child} isOpen={isOpen} toggle={toggle} />
          ))}
        </div>
      )}
    </div>
  );
}

function Legend() {
  const item = (icon: React.ReactNode, label: string) => (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      {icon}
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-hairline pt-3">
      {item(<ShieldCheck className="size-3.5 text-blue-600" />, "Verified")}
      {item(<GigBadge done={true} />, "Completed a gig")}
      {item(<GigBadge done={false} />, "No completed gig yet")}
      {item(<LevelChip depth={1} />, "Invited by you")}
      {item(<LevelChip depth={2} />, "Invited by your referral")}
      <span className="text-xs text-muted">Tap a person to show or hide who they invited</span>
    </div>
  );
}

export default function ReferralTreePage({ role }: { role: "host" | "worker" }) {
  const uid = useAppSelector((root) => root.user.authUser?.uid);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReferralTreeResult | null>(null);
  const [toggled, setToggled] = useState<Set<string>>(new Set());

  async function load() {
    setError(null);
    try {
      const data = await getMyReferralTree();
      setResult(data);
      setToggled(new Set());
    } catch (err) {
      console.error("Failed to load referral tree:", err);
      setError("Couldn't load your referral tree. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function retry() {
    setLoading(true);
    load();
  }

  useEffect(() => {
    if (!uid) return;
    // Resetting before (re)fetching, not reacting to loading itself.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    retry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const { tree, levelCounts } = useMemo(
    () => (result ? buildReferralTree(result.members) : { tree: [] as TreeNode[], levelCounts: [] as number[] }),
    [result]
  );

  function isOpen(node: TreeNode) {
    return (node.depth < AUTO_OPEN_DEPTH) !== toggled.has(node.uid);
  }

  function toggle(uid: string) {
    setToggled((prev) => {
      const next = new Set(prev);
      if (!next.delete(uid)) next.add(uid);
      return next;
    });
  }

  function setAll(open: boolean) {
    const next = new Set<string>();
    function walk(nodes: TreeNode[]) {
      for (const n of nodes) {
        if (n.children.length > 0 && (n.depth < AUTO_OPEN_DEPTH) !== open) next.add(n.uid);
        walk(n.children);
      }
    }
    walk(tree);
    setToggled(next);
  }

  if (!uid) return null;

  return (
    <JoshDiv>
      <Link
        href={`/app/${role}/referrals`}
        className="mb-2 flex w-fit items-center gap-1 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        My Referrals
      </Link>
      <TitlePage title="Referral Tree" description="See who your referrals invited and what you've earned" />

      <div className="mx-auto mt-6 max-w-3xl space-y-5">
        {error && (
          <Card className="flex-row items-center justify-between gap-3 border-destructive/25 bg-destructive/8 p-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button size="sm" variant="outline" onClick={retry}>
              <RefreshCw className="size-3.5" />
              Retry
            </Button>
          </Card>
        )}

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : (
          <>
            <Card className="flex-row items-center gap-3 p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--success-tint) text-(--success-text)">
                <Users className="size-4" />
              </div>
              <div>
                <p className="text-lg font-bold text-(--success-text)">
                  {result?.earnings ? money(result.earnings.total) : "—"}
                </p>
                <p className="text-xs text-muted">Referral earnings</p>
              </div>
            </Card>

            <EarningsCard earnings={result?.earnings ?? null} />

            <Card className="p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-ink">Your network</p>
                {tree.length > 0 && (
                  <div className="flex gap-1.5">
                    <Button size="xs" variant="outline" onClick={() => setAll(true)}>
                      Expand all
                    </Button>
                    <Button size="xs" variant="outline" onClick={() => setAll(false)}>
                      Collapse all
                    </Button>
                  </div>
                )}
              </div>
              {levelCounts.length > 0 && (
                <p className="mt-1 text-xs text-muted">
                  {levelCounts.map((c, i) => `${levelName(i)}: ${c}`).join(" · ")}
                </p>
              )}

              <div className="mt-3 flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/8 px-2.5 py-2">
                <PersonAvatar verified={result?.root.isVerified ?? false} />
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{result?.root.name ?? "You"} (you)</span>
                {result?.root.referralCode && <span className="font-mono text-xs text-muted">{result.root.referralCode}</span>}
                <GigBadge done={result?.root.gigDone ?? false} />
              </div>

              {tree.length === 0 ? (
                <p className="mt-6 text-center text-sm text-muted">
                  You haven&apos;t invited anyone yet.
                  <br />
                  Share your referral code to grow your network.
                </p>
              ) : (
                <div className="mt-2 ml-2.5 border-l border-hairline pl-2.5">
                  {tree.map((node) => (
                    <NodeRow key={node.uid} node={node} isOpen={isOpen} toggle={toggle} />
                  ))}
                </div>
              )}

              {result?.truncated && (
                <p className="mt-2 text-xs text-muted">Your network is very large — only part of it is shown.</p>
              )}

              {tree.length > 0 && (
                <div className="mt-4">
                  <Legend />
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </JoshDiv>
  );
}
