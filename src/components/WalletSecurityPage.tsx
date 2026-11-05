"use client";

import Link from "next/link";
import {
  BadgeCheck,
  ChevronRight,
  CloudCog,
  FileText,
  HelpCircle,
  KeyRound,
  Lock,
  PhoneOff,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import TitlePage from "@/components/TitlePage";
import JoshDiv from "@/components/DivAnimation";
import { Card } from "@/components/ui/card";

// Mirrors giggre_app's security_privacy_centre_screen.dart — static, factual
// copy about what Giggre actually protects, opened from Gig Wallet's
// security banner. Contact Us / Help FAQ are two separate screens in the
// app; this site only has one combined Help & Support page, so both links
// point there.

function InfoRow({ icon: Icon, title, body }: { icon: typeof ShieldCheck; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 p-3.5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--worker-tint) text-(--worker-text)">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-xs text-muted">{body}</p>
      </div>
    </div>
  );
}

function LinkRow({ icon: Icon, label, href }: { icon: typeof ShieldCheck; label: string; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 p-3.5 transition-colors hover:bg-accent">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--worker-tint) text-(--worker-text)">
        <Icon className="size-4" />
      </div>
      <p className="flex-1 text-sm font-semibold text-ink">{label}</p>
      <ChevronRight className="size-4 shrink-0 text-muted" />
    </Link>
  );
}

export default function WalletSecurityPage({ role }: { role: "host" | "worker" }) {
  return (
    <JoshDiv>
      <TitlePage title="Security and Privacy Centre" description="How Giggre protects your account, Gig Wallet and personal information" />

      <div className="mx-auto mt-6 max-w-2xl space-y-5">
        <Card className="flex-row items-center gap-3.5 p-5">
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-(--worker-tint) text-(--worker-text)">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <p className="font-semibold text-ink">Your safety comes first</p>
            <p className="mt-1 text-sm text-muted">
              How Giggre protects your account, Gig Wallet and personal information, and what you can do to stay safe.
            </p>
          </div>
        </Card>

        <div>
          <p className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">How we protect you</p>
          <Card className="divide-y divide-hairline gap-0 p-0">
            <InfoRow icon={Lock} title="Encrypted connections" body="Everything sent between the app and our servers is encrypted in transit, so it can't be read along the way." />
            <InfoRow icon={CloudCog} title="Secure cloud storage" body="Your data is stored on Google Cloud (Firebase), which encrypts it at rest." />
            <InfoRow icon={BadgeCheck} title="Verified accounts" body="Users can verify their identity, so you know who you're working with or hiring." />
          </Card>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">Keep your account safe</p>
          <Card className="divide-y divide-hairline gap-0 p-0">
            <InfoRow icon={KeyRound} title="Never share your password or codes" body="Giggre staff will never ask for your password or one-time verification codes." />
            <InfoRow icon={ShieldAlert} title="Keep payments in the app" body="Be careful if someone asks you to pay or get paid outside Giggre. We can't help with off-app payments." />
            <InfoRow icon={PhoneOff} title="Log out on shared devices" body="Always log out if you use Giggre on a phone that isn't yours." />
            <LinkRow icon={ShieldCheck} label="Verify your account" href={`/app/${role}/verification`} />
          </Card>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">Your privacy</p>
          <Card className="divide-y divide-hairline gap-0 p-0">
            <LinkRow icon={FileText} label="Privacy Policy" href="/privacy-policy" />
            <LinkRow icon={FileText} label="Terms and Conditions" href="/terms" />
          </Card>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">Need help?</p>
          <Card className="divide-y divide-hairline gap-0 p-0">
            <LinkRow icon={ShieldAlert} label="Report a problem or suspicious activity" href={`/app/${role}/support`} />
            <LinkRow icon={HelpCircle} label="Help & Support" href={`/app/${role}/support`} />
          </Card>
        </div>
      </div>
    </JoshDiv>
  );
}
