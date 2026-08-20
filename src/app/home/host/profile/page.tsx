"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAppSelector } from "@/store/hooks";

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

  return (
    <div className="mx-auto max-w-2xl p-4">
      <h1 className="font-display text-2xl font-semibold text-ink">Profile</h1>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarImage src={profile?.photoUrl || undefined} alt={name} />
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-lg">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{name || "Unnamed"}</CardTitle>
              <p className="text-sm text-muted">{profile?.email ?? authUser?.email}</p>
              {profile?.bio && <p className="mt-1 text-sm text-muted">{profile.bio}</p>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant={profile?.isVerified === "verified" ? "default" : "secondary"}>
              {profile?.isVerified === "verified" ? "Verified" : "Unverified"}
            </Badge>
            {profile?.role && <Badge variant="outline">{profile.role}</Badge>}
          </div>

          <Separator className="my-4" />

          <Row label="Phone" value={profile?.phone} />
          <Row label="Company" value={profile?.company} />
          <Row label="User ID" value={profile?.userId} />
          <Row
            label="Balance"
            value={profile?.balance !== undefined ? `${profile.currencyCode ?? ""} ${profile.balance}`.trim() : undefined}
          />
          <Row label="Rating as worker" value={profile?.ratingAsWorker} />
          <Row label="Rating as host" value={profile?.ratingAsHost} />
          <Row label="Referral code" value={profile?.referrals?.referral_code} />
          <Row label="Referrals" value={profile?.referrals?.referrals_count} />
        </CardContent>
      </Card>
    </div>
  );
}
