"use client";

import { Briefcase, Check, Mail, Phone, ShieldCheck } from "lucide-react";
import TitlePage from "@/components/TitlePage";
import JoshDiv from "@/components/DivAnimation";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAppSelector } from "@/store/hooks";

function MetaItem({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-muted">
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{children}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}

export default function HostProfilePage() {
  const { authUser, profile } = useAppSelector((root) => root.user);
  const name = profile?.name ?? authUser?.displayName ?? "";
  const initials = name.slice(0, 2).toUpperCase() || "?";
  const isVerified = profile?.isVerified === "verified";

  return (
    <JoshDiv>
      <TitlePage title="Profile" description="View your host account information" />

      <Card className="mt-6 max-w-2xl px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <Avatar className="size-20 shrink-0 ring-2 ring-(--host-start)/25 ring-offset-2 ring-offset-card">
            <AvatarImage src={profile?.photoUrl || undefined} alt={name} />
            <AvatarFallback className="rounded-full bg-(--host-end) text-2xl text-sidebar-primary-foreground">
              {initials}
            </AvatarFallback>
            {isVerified && (
              <AvatarBadge className="bg-(--success-start)">
                <Check className="text-white" />
              </AvatarBadge>
            )}
          </Avatar>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-ink">{name || "Unnamed"}</h2>
              {isVerified && (
                <Badge className="gap-1 bg-(--success-tint) text-(--success-text)">
                  <ShieldCheck className="size-3" />
                  Verified
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              {(profile?.email ?? authUser?.email) && (
                <MetaItem icon={Mail}>{profile?.email ?? authUser?.email}</MetaItem>
              )}
              {profile?.phone && <MetaItem icon={Phone}>{profile.phone}</MetaItem>}
              {profile?.company && <MetaItem icon={Briefcase}>{profile.company}</MetaItem>}
            </div>

            {profile?.bio && <p className="text-sm text-muted whitespace-pre-line">{profile.bio}</p>}
          </div>
        </div>

        <Separator className="my-5" />

        <Row
          label="Balance"
          value={profile?.balance !== undefined ? `${profile.currencyCode ?? ""} ${profile.balance}`.trim() : undefined}
        />
        <Row label="Rating as host" value={profile?.ratingAsHost} />
        <Row label="Rating as worker" value={profile?.ratingAsWorker} />
        <Row label="Referral code" value={profile?.referrals?.referral_code} />
        <Row label="Referrals" value={profile?.referrals?.referrals_count} />
      </Card>
    </JoshDiv>
  );
}
