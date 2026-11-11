"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, type Timestamp } from "firebase/firestore";
import { Award, CheckCircle2, Gift, Tag } from "lucide-react";
import { useDistanceUnits } from "@/hooks/use-distance-units";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { redeemPromoCode } from "@/lib/firebase-functions";
import { useAppSelector } from "@/store/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// Settings → Promo code. Same as the app's Profile → Promo Code: redeem a
// code from giggre-admin → Promotions, and see gig cashback vouchers.

interface Voucher {
  id: string;
  promoCode: string;
  mode: "percent" | "fixed";
  percent: number | null;
  maxCashback: number | null;
  amount: number | null;
  currencyCode: string;
  status: "active" | "used";
  cashbackAmount?: number;
  expiresAt: Date | null;
  createdAt: number;
}

const money = (n: number, ccy: string) =>
  `${ccy === "PHP" ? "₱" : "$"}${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

function errorText(err: unknown): string {
  const e = err as { code?: string; message?: string };
  const code = (e?.code ?? "").replace("functions/", "");
  if (["not-found", "already-exists", "failed-precondition"].includes(code)) return e.message || "This promo code can't be used.";
  if (code === "unauthenticated") return "Please sign in again to use a promo code.";
  return "Couldn't redeem the code right now. Please try again.";
}

interface Offer { id: string; code: string; name: string; rewardText: string; access: string; note: string | null; endsAt: Date | null; redeemed: boolean }
interface PublicPromo { code: string; name: string; rewardText: string; rewardTextPHP?: string; rewardTextUSD?: string; region: string; startsAt: Date | null; endsAt: Date | null }

const until = (d: Date | null) => (d ? `Until ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : null);

export function PromoCodeCard() {
  const uid = useAppSelector((root) => root.user.authUser?.uid);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [publicPromos, setPublicPromos] = useState<PublicPromo[]>([]);
  // Read once per mount via a lazy initializer rather than calling Date.now()
  // directly in the render body (same pattern as WorkingTimer.tsx).
  const [now] = useState(() => Date.now());
  // Region for ₱ / $ wording and region-only codes — same detection as miles/km.
  const { miles } = useDistanceUnits();
  const ph = !miles;

  useEffect(() => {
    if (!uid) return;
    const unsubOffers = onSnapshot(
      query(collection(db, "promo_offers"), where("uid", "==", uid)),
      (snap) => setOffers(snap.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id, code: x.code, name: x.name ?? "Promo", rewardText: x.rewardText ?? "", access: x.access ?? "private",
          note: x.note ?? null, endsAt: (x.endsAt as Timestamp | undefined)?.toDate() ?? null, redeemed: x.redeemed === true,
        };
      })),
      (err) => console.warn("[PromoCodeCard] offers:", err.code ?? err),
    );
    const unsubPublic = onSnapshot(
      collection(db, "promo_public"),
      (snap) => setPublicPromos(snap.docs.map((d) => {
        const x = d.data();
        return {
          code: x.code ?? d.id, name: x.name ?? "Promo", rewardText: x.rewardText ?? "", rewardTextPHP: x.rewardTextPHP,
          rewardTextUSD: x.rewardTextUSD, region: x.region ?? "any",
          startsAt: (x.startsAt as Timestamp | undefined)?.toDate() ?? null, endsAt: (x.endsAt as Timestamp | undefined)?.toDate() ?? null,
        };
      })),
      (err) => console.warn("[PromoCodeCard] public promos:", err.code ?? err),
    );
    return () => {
      unsubOffers();
      unsubPublic();
    };
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(collection(db, "promo_vouchers"), where("uid", "==", uid)),
      (snap) => setVouchers(
        snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id, promoCode: x.promoCode, mode: x.mode, percent: x.percent ?? null, maxCashback: x.maxCashback ?? null,
            amount: x.amount ?? null, currencyCode: x.currencyCode ?? "USD", status: x.status, cashbackAmount: x.cashbackAmount,
            expiresAt: (x.expiresAt as Timestamp | undefined)?.toDate() ?? null,
            createdAt: (x.createdAt as Timestamp | undefined)?.toMillis() ?? 0,
          } as Voucher;
        }).sort((a, b) => b.createdAt - a.createdAt),
      ),
      (err) => console.warn("[PromoCodeCard] vouchers:", err.code ?? err),
    );
  }, [uid]);

  async function redeem(override?: string) {
    const c = (override ?? code).trim().toUpperCase().replace(/\s+/g, "");
    if (!c) return setError("Enter a promo code.");
    setBusy(true);
    setError(null);
    try {
      const res = await redeemPromoCode(c);
      setCode("");
      toast.success(res.name ?? "Promo applied", { description: res.message });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Promo code</CardTitle>
        <CardDescription>Get Gig Points, Gig Wallet credit or a gig cashback voucher.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            redeem();
          }}
        >
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_\- ]/g, "").slice(0, 30))}
            placeholder="e.g. GIG-7KQ2XM"
            className="font-mono tracking-wider"
            disabled={busy}
            aria-invalid={!!error}
          />
          <Button type="submit" disabled={busy}>
            {busy ? "Redeeming…" : "Redeem"}
          </Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}

        <PromoList
          title="For you"
          items={offers
            .filter((o) => !o.redeemed && (!o.endsAt || o.endsAt.getTime() > now))
            .map((o) => ({
              code: o.code, name: o.name, note: o.note, restricted: o.access === "restricted",
              line: [o.rewardText, o.access === "restricted" ? "Just for you" : null, until(o.endsAt)].filter(Boolean).join(" · "),
            }))}
          busy={busy}
          onUse={(c) => { setCode(c); redeem(c); }}
        />
        <PromoList
          title="Available promos"
          items={publicPromos
            .filter((p) => (!p.startsAt || p.startsAt.getTime() <= now) && (!p.endsAt || p.endsAt.getTime() > now))
            .filter((p) => p.region === "any" || (p.region === "PH") === ph)
            .map((p) => ({
              code: p.code, name: p.name, note: null, restricted: false,
              line: [(ph ? p.rewardTextPHP : p.rewardTextUSD) ?? p.rewardText, until(p.endsAt)].filter(Boolean).join(" · "),
            }))}
          busy={busy}
          onUse={(c) => { setCode(c); redeem(c); }}
        />

        {vouchers.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">My cashback vouchers</p>
            <p className="text-xs text-muted">Used automatically on your next completed gig as a host.</p>
            {vouchers.map((v) => {
              const used = v.status === "used";
              const expired = !used && !!v.expiresAt && v.expiresAt.getTime() < now;
              const what = v.mode === "fixed"
                ? `${money(v.amount ?? 0, v.currencyCode)} cashback`
                : `${v.percent}% cashback (up to ${money(v.maxCashback ?? 0, v.currencyCode)})`;
              const status = used
                ? `Paid ${money(v.cashbackAmount ?? 0, v.currencyCode)} to your wallet`
                : expired
                  ? "Expired"
                  : `Active${v.expiresAt ? ` · use by ${v.expiresAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}`;
              return (
                <div key={v.id} className="flex items-center gap-3 rounded-lg border border-hairline p-3">
                  {used ? <CheckCircle2 className="size-4 text-(--success-text)" /> : <Tag className={expired ? "size-4 text-muted" : "size-4 text-amber-500"} />}
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink">{what}</div>
                    <div className="text-xs text-muted">{v.promoCode} · {status}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PromoList({ title, items, busy, onUse }: {
  title: string;
  items: { code: string; name: string; line: string; note: string | null; restricted: boolean }[];
  busy: boolean;
  onUse: (code: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-ink">{title}</p>
      {items.map((i) => (
        <div key={i.code} className="flex items-center gap-3 rounded-lg border border-amber-400/40 p-3">
          {i.restricted ? <Award className="size-4 shrink-0 text-amber-500" /> : <Gift className="size-4 shrink-0 text-amber-500" />}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-ink">{i.name}</div>
            <div className="text-xs text-muted">{i.line}</div>
            {i.note && <div className="text-xs italic text-muted">{i.note}</div>}
            <div className="mt-1 font-mono text-xs font-semibold tracking-wider text-ink">{i.code}</div>
          </div>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onUse(i.code)}>Use</Button>
        </div>
      ))}
    </div>
  );
}
