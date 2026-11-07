import { doc, getDocFromServer, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { fetchFxRates, fromUsd, perUsd, type FxRates } from "@/lib/fx-rates";
import { currencySymbol } from "@/lib/utils";

// Unverified-account earning limit — mirrors giggre_app
// lib/core/services/unverified_limit.dart (guard + dialog text) and
// functions/src/unverifiedLimits.ts (periodKey). Keep the period key in sync
// with both (and giggre-admin lib/unverifiedLimit.ts).
//
//   general_config/unverified_limits { enabled, maxUsd, resetPeriod, resetEpoch }
//   transaction_totals/{uid} { periodKey, worker: {CCY: amt}, host: {CCY: amt}, gigs }
//
// Unverified users can transact (paid as worker + paid out as host) up to
// maxUsd per period. The site checks before applying for / accepting /
// posting a gig and shows how much is used on the earnings page. Like the
// app, a read failure lets the action through.

export type ResetPeriod = "never" | "daily" | "weekly" | "monthly" | "yearly";
const PERIODS: ResetPeriod[] = ["never", "daily", "weekly", "monthly", "yearly"];

export interface LimitConfig {
  enabled: boolean;
  maxUsd: number | null;
  resetPeriod: ResetPeriod;
  resetEpoch: number;
}

const pos = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
const pad = (n: number) => String(n).padStart(2, "0");

export function toLimitConfig(d: Record<string, unknown> | undefined): LimitConfig {
  const p = PERIODS.includes(d?.resetPeriod as ResetPeriod) ? (d!.resetPeriod as ResetPeriod) : "never";
  return { enabled: d?.enabled === true, maxUsd: pos(d?.maxUsd), resetPeriod: p, resetEpoch: pos(d?.resetEpoch) ?? 0 };
}

/** Current counting period (Philippine time, weeks start Monday). */
export function periodKey(cfg: Pick<LimitConfig, "resetPeriod" | "resetEpoch">, nowMs = Date.now()): string {
  const t = new Date(nowMs + 8 * 3600_000);
  const y = t.getUTCFullYear(), m = t.getUTCMonth() + 1, d = t.getUTCDate();
  let bucket: string;
  switch (cfg.resetPeriod) {
    case "daily": bucket = `${y}-${pad(m)}-${pad(d)}`; break;
    case "weekly": {
      const mon = new Date(Date.UTC(y, m - 1, d - ((t.getUTCDay() + 6) % 7)));
      bucket = `${mon.getUTCFullYear()}-${pad(mon.getUTCMonth() + 1)}-${pad(mon.getUTCDate())}`;
      break;
    }
    case "monthly": bucket = `${y}-${pad(m)}`; break;
    case "yearly": bucket = `${y}`; break;
    default: bucket = "all";
  }
  return `${Math.round(cfg.resetEpoch)}|${cfg.resetPeriod}|${bucket}`;
}

export const RESET_NOTE: Record<ResetPeriod, string> = {
  never: "",
  daily: "The limit resets every day.",
  weekly: "The limit resets every Monday.",
  monthly: "The limit resets on the 1st of every month.",
  yearly: "The limit resets every January 1.",
};

export interface LimitUsage { workerUsd: number; hostUsd: number; usedUsd: number }

const toUsd = (fx: FxRates, amount: number, ccy: string) => {
  const r = perUsd(fx, ccy);
  return r && r > 0 ? amount / r : amount;
};

/** Usage in the current period, USD. Older periods / before a reset count as 0. */
export function usageOf(totals: Record<string, unknown> | undefined | null, cfg: LimitConfig, fx: FxRates): LimitUsage {
  const current = totals && (totals.periodKey ?? "0|never|all") === periodKey(cfg) ? totals : null;
  const side = (k: string) => {
    let sum = 0;
    const m = current?.[k];
    if (m && typeof m === "object") {
      for (const [ccy, v] of Object.entries(m as Record<string, unknown>)) {
        if (typeof v === "number" && v > 0) sum += toUsd(fx, v, ccy);
      }
    }
    return sum;
  };
  const workerUsd = side("worker"), hostUsd = side("host");
  return { workerUsd, hostUsd, usedUsd: workerUsd + hostUsd };
}

export type LimitAction = "apply" | "accept" | "post";

export interface LimitBlock {
  title: string;
  message: string;
}

const money = (fx: FxRates, usd: number, ccy: string) => {
  const v = fromUsd(fx, usd, ccy) ?? usd;
  return `${currencySymbol(ccy)}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * null = go ahead; otherwise why the action is blocked (same wording as the
 * app's "Unable to Apply / Accept Gig / Post Gig" prompt).
 */
export async function checkUnverifiedLimit(input: {
  uid: string;
  amount: number;
  currencyCode: string;
  action: LimitAction;
}): Promise<LimitBlock | null> {
  try {
    const [userSnap, cfgSnap] = await Promise.all([
      getDocFromServer(doc(db, "users", input.uid)),
      getDocFromServer(doc(db, "general_config", "unverified_limits")),
    ]);
    if (userSnap.data()?.isVerified === "verified") return null;
    const cfg = toLimitConfig(cfgSnap.data());
    if (!cfg.enabled || cfg.maxUsd == null) return null;
    const [totalsSnap, fx] = await Promise.all([
      getDocFromServer(doc(db, "transaction_totals", input.uid)),
      fetchFxRates(),
    ]);
    const { usedUsd } = usageOf(totalsSnap.data(), cfg, fx);
    const newUsd = input.amount > 0 ? toUsd(fx, input.amount, input.currencyCode) : 0;
    const max = cfg.maxUsd;
    if (usedUsd + newUsd <= max + 0.005) return null;

    const ccy = perUsd(fx, input.currencyCode) != null ? input.currencyCode : "USD";
    const isHost = input.action === "post";
    const verb = input.action === "apply" ? "apply for" : input.action;
    const limitName = isHost
      ? `the ${money(fx, max, ccy)} limit unverified accounts can spend on gigs`
      : `the ${money(fx, max, ccy)} limit unverified accounts can earn`;
    const gig = `${currencySymbol(input.currencyCode)}${input.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    let reason: string;
    if (usedUsd >= max - 0.005) {
      reason = `Your account isn't verified and you've already reached ${limitName}. Verify your account to ${verb} more gigs.`;
    } else if (newUsd > max + 0.005) {
      reason = `Your account isn't verified. This gig ${isHost ? "costs" : "pays"} ${gig}, which is more than ${limitName}. Verify your account to ${verb} it.`;
    } else {
      reason = `Your account isn't verified. This gig (${gig}) would take you over ${limitName} — you only have ${money(fx, max - usedUsd, ccy)} left. Verify your account to ${verb} it.`;
    }
    const note = RESET_NOTE[cfg.resetPeriod];
    return {
      title: input.action === "apply" ? "Unable to Apply" : input.action === "accept" ? "Unable to Accept Gig" : "Unable to Post Gig",
      message: note ? `${reason} ${note}` : reason,
    };
  } catch (err) {
    console.warn("[unverified-limit] check failed — allowing", err);
    return null;
  }
}

/** Live config + this user's totals (for the earnings progress bar). */
export function subscribeLimitState(
  uid: string,
  onData: (s: { cfg: LimitConfig; totals: Record<string, unknown> | null }) => void,
): Unsubscribe {
  let cfg: LimitConfig | null = null;
  let totals: Record<string, unknown> | null | undefined;
  const emit = () => cfg && totals !== undefined && onData({ cfg, totals });
  const u1 = onSnapshot(doc(db, "general_config", "unverified_limits"),
    (s) => { cfg = toLimitConfig(s.data()); emit(); }, () => {});
  const u2 = onSnapshot(doc(db, "transaction_totals", uid),
    (s) => { totals = s.data() ?? null; emit(); }, () => { totals = null; emit(); });
  return () => { u1(); u2(); };
}
