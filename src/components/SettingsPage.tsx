"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Ban,
  CheckCircle2,
  CircleX,
  Hourglass,
  LockKeyhole,
  MinusCircle,
  Radar,
  Repeat,
  SettingsIcon,
  ShieldOff,
  Timer,
  Trash2,
} from "lucide-react";
import TitlePage from "@/components/TitlePage";
import JoshDiv from "@/components/DivAnimation";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  fetchDeclineSuspensionConfig,
  fetchMatchingDisplayConfig,
  type DeclineSuspensionConfig,
  type MatchingDisplayConfig,
} from "@/lib/quick-gig-matching";
import { useAppSelector } from "@/store/hooks";

function formatRemaining(until: Date): string {
  const totalSeconds = Math.floor((until.getTime() - Date.now()) / 1000);
  if (totalSeconds <= 0) return "Expired";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Mirrors _QuickGigStatusCard in worker_settings_screen.dart — same two
// rows (decline count, suspension countdown), sourced from the same
// users/{uid} fields (decline_count, decline_count_date, suspended_until)
// and the same quick_gig_config/decline_suspension admin doc for the
// free-decline limit. Worker-only: hosts don't decline Quick Gigs.
function QuickGigStatusCard() {
  const profile = useAppSelector((root) => root.user.profile);
  const [freeDeclineLimit, setFreeDeclineLimit] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    fetchDeclineSuspensionConfig()
      .then((config) => setFreeDeclineLimit(config.freeDeclineLimit))
      .catch(() => {});
  }, []);

  const suspendedUntil = profile?.suspended_until ? new Date(profile.suspended_until) : null;
  const isSuspended = !!suspendedUntil && suspendedUntil.getTime() > now;

  useEffect(() => {
    if (!isSuspended) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isSuspended]);

  const declineCount = profile?.decline_count_date === todayStr() ? profile?.decline_count ?? 0 : 0;
  const declinesOver = freeDeclineLimit > 0 && declineCount > freeDeclineLimit;
  const declinesLabel = freeDeclineLimit > 0 ? `${declineCount} / ${freeDeclineLimit} free` : `${declineCount}`;

  return (
    <Card className={cn(isSuspended && "border-destructive/40")}>
      <CardHeader>
        <CardTitle>Quick Gig Status</CardTitle>
        <CardDescription>Excessive Quick Gig declines can lead to a temporary suspension.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              declinesOver ? "bg-orange-500/10 text-orange-600" : "bg-amber-500/10 text-amber-600"
            )}
          >
            <MinusCircle className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted">Decline Count</p>
            <p className={cn("text-sm font-semibold", declinesOver ? "text-orange-600" : "text-ink")}>
              {declinesLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              isSuspended ? "bg-destructive/10 text-destructive" : "bg-(--success-tint) text-(--success-text)"
            )}
          >
            {isSuspended ? <LockKeyhole className="size-4" /> : <CheckCircle2 className="size-4" />}
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted">Suspension</p>
            <p className={cn("text-sm font-semibold", isSuspended ? "text-destructive" : "text-(--success-text)")}>
              {isSuspended && suspendedUntil ? `Suspended — ${formatRemaining(suspendedUntil)}` : "Not suspended"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfigRow({
  label,
  value,
  icon: Icon,
  iconClassName,
}: {
  label: string;
  value: string;
  icon: typeof Ban;
  iconClassName: string;
}) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <Icon className={cn("size-3.5 shrink-0", iconClassName)} />
      <p className="flex-1 text-xs text-muted">{label}</p>
      <p className="text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function fmt(value: number | undefined, fallback = "—"): string {
  return value === undefined ? fallback : String(value);
}

// Mirrors _ConfigCard("Decline & Suspension") in worker_settings_screen.dart
// — read-only admin config, purely informational (nothing here is
// editable; it just explains the rules behind QuickGigStatusCard above).
function DeclineSuspensionConfigCard({ config }: { config: DeclineSuspensionConfig | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Ban className="size-3.5 text-destructive" />
          Decline &amp; Suspension
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!config ? (
          <p className="text-xs text-muted">No config available</p>
        ) : (
          <>
            <ConfigRow
              label="Free Decline Limit"
              value={fmt(config.freeDeclineLimit)}
              icon={MinusCircle}
              iconClassName="text-orange-500"
            />
            <ConfigRow
              label="Suspension Enabled"
              value={config.suspensionEnabled === true ? "Yes" : "No"}
              icon={config.suspensionEnabled === true ? CheckCircle2 : CircleX}
              iconClassName={config.suspensionEnabled === true ? "text-(--success-text)" : "text-muted"}
            />
            {config.tiers.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">Suspension Tiers</p>
                {config.tiers.map((tier, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 rounded-lg border border-destructive/15 bg-destructive/5 px-3 py-2"
                  >
                    <span className="flex size-5.5 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-[10px] font-bold text-destructive">
                      {i + 1}
                    </span>
                    <p className="flex-1 text-xs text-muted">After {fmt(tier.trigger)} declines</p>
                    <p className="text-xs font-semibold text-destructive">{fmt(tier.durationMinutes)} min suspension</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Mirrors _ConfigCard("Gig Matching") in worker_settings_screen.dart.
function GigMatchingConfigCard({ config }: { config: MatchingDisplayConfig | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <SettingsIcon className="size-3.5 text-(--worker-text)" />
          Gig Matching
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!config ? (
          <p className="text-xs text-muted">No config available</p>
        ) : (
          <>
            <ConfigRow
              label="Allow Reassignment"
              value={config.allowReassignment === true ? "Yes" : "No"}
              icon={config.allowReassignment === true ? CheckCircle2 : CircleX}
              iconClassName={config.allowReassignment === true ? "text-(--success-text)" : "text-muted"}
            />
            <ConfigRow
              label="Max Match Attempts"
              value={fmt(config.maxDispatchAttempts)}
              icon={Repeat}
              iconClassName="text-blue-500"
            />
            <ConfigRow
              label="Max Search Radius (km)"
              value={config.maxSearchRadiusKm != null ? String(config.maxSearchRadiusKm) : "Unlimited"}
              icon={Radar}
              iconClassName="text-teal-500"
            />
            <ConfigRow
              label="Response Time (sec)"
              value={fmt(config.reviewWindowSeconds)}
              icon={Timer}
              iconClassName="text-purple-500"
            />
            <ConfigRow
              label="Search Timeout (min)"
              value={fmt(config.searchTimeoutMinutes)}
              icon={Hourglass}
              iconClassName="text-orange-500"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Shared between /app/host/settings and /app/worker/settings — mirrors the
// "Account" section of worker_settings_screen.dart in the Flutter app
// (Blocked Users + Delete Account are the only two entries there beyond
// dark mode, which this app already exposes globally via the header's
// ThemeToggle). Quick Gig Status mirrors that same screen's worker-only
// decline/suspension section, so it's gated to the worker settings page.
export default function SettingsPage() {
  const pathname = usePathname();
  const basePath = pathname.startsWith("/app/host") ? "/app/host" : "/app/worker";
  const isWorker = basePath === "/app/worker";

  const [declineSuspensionConfig, setDeclineSuspensionConfig] = useState<DeclineSuspensionConfig | null>(null);
  const [matchingConfig, setMatchingConfig] = useState<MatchingDisplayConfig | null>(null);

  useEffect(() => {
    if (!isWorker) return;
    fetchDeclineSuspensionConfig().then(setDeclineSuspensionConfig).catch(() => {});
    fetchMatchingDisplayConfig().then(setMatchingConfig).catch(() => {});
  }, [isWorker]);

  return (
    <JoshDiv>
      <TitlePage title="Settings" description="Account settings" />

      <div className="mt-6 space-y-4">
        {isWorker && (
          <>
            <QuickGigStatusCard />
            <DeclineSuspensionConfigCard config={declineSuspensionConfig} />
            <GigMatchingConfigCard config={matchingConfig} />
          </>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Blocked users</CardTitle>
            <CardDescription>People you&apos;ve blocked can&apos;t message you or see your gigs.</CardDescription>
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                render={<Link href={`${basePath}/blocked-users`} />}
                nativeButton={false}
              >
                <ShieldOff className="size-3.5" />
                Manage
              </Button>
            </CardAction>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delete account</CardTitle>
            <CardDescription>
              Request account deletion — reviewed and completed within 30 days. You can cancel anytime
              before then.
            </CardDescription>
            <CardAction>
              <Button
                variant="destructive"
                size="sm"
                render={<Link href="/delete-account" />}
                nativeButton={false}
              >
                <Trash2 className="size-3.5" />
                Delete account
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted">
              This opens a separate page where you&apos;ll confirm your password (or Google sign-in)
              before a deletion request is submitted.
            </p>
          </CardContent>
        </Card>
      </div>
    </JoshDiv>
  );
}
