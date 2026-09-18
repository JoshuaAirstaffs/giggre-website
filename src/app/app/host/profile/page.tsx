"use client";

import { Check, InfoIcon, Mail, Pencil, Phone, ShieldCheck, Star } from "lucide-react";
import TitlePage from "@/components/TitlePage";
import JoshDiv from "@/components/DivAnimation";
import ReferralsCard from "@/components/ReferralsCard";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAppSelector } from "@/store/hooks";
import { formatDate } from "@/lib/utils";
import { useHostCompletedEntries } from "@/hooks/use-host-completed-entries";
import SpendChartCard from "../components/SpendChartCard";
import EditProfileDialog from "./components/EditProfileDialog";
import ProfileOverviewStats from "./components/ProfileOverviewStats";

function MetaItem({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-muted">
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{children}</span>
    </div>
  );
}

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={i < Math.round(value) ? "size-3.5 fill-host text-host" : "size-3.5 text-hairline"}
          />
        ))}
      </div>
      <span className="text-xs text-muted">{value.toFixed(1)}</span>
    </div>
  );
}

export default function HostProfilePage() {
  const { authUser, profile } = useAppSelector((root) => root.user);
  const name = profile?.name ?? authUser?.displayName ?? "";
  const initials = name.slice(0, 2).toUpperCase() || "?";
  const isVerified = profile?.isVerified === "verified";
  const { entries, loading: entriesLoading, error: entriesError } = useHostCompletedEntries(authUser?.uid);

  return (
    <JoshDiv>
      <div className="flex items-center justify-between">
        <TitlePage title="Profile" description="View and manage your host account information" />
        <EditProfileDialog>
          <Button variant="outline" size="sm">
            <Pencil className="size-3.5" />
            Edit Profile
          </Button>
        </EditProfileDialog>
      </div>

      {!isVerified && (
        <Alert className="my-6 max-w-xl border-(--host-end)/30 bg-(--host-tint) text-(--host-text)">
          <InfoIcon />
          <AlertTitle>Account not verified</AlertTitle>
          <AlertDescription className="py-2">
            Upload a valid ID for both worker and host as proof before requesting verification from admin.
          </AlertDescription>
          <AlertAction>
            <Button size="xs" variant="default" className="bg-(--host-end) text-on-host">
              Go to My Documents
            </Button>
          </AlertAction>
        </Alert>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Card className="px-6 py-6 sm:px-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <Avatar className="size-20 shrink-0 ring-2 ring-(--host-start)/25 ring-offset-2 ring-offset-card">
                <AvatarImage src={profile?.photoUrl || undefined} alt={name} />
                <AvatarFallback className="rounded-full bg-(--host-end) text-2xl text-on-host">
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

                {profile?.company && <p className="text-sm text-muted">{profile.company}</p>}

                <StarRating value={profile?.ratingAsHost ?? 5} />

                <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                  {(profile?.email ?? authUser?.email) && (
                    <MetaItem icon={Mail}>{profile?.email ?? authUser?.email}</MetaItem>
                  )}
                  {profile?.phone && <MetaItem icon={Phone}>{profile.phone}</MetaItem>}
                  <p className="text-sm text-muted">Member since {formatDate(profile?.createdAt)}</p>
                </div>
              </div>
            </div>

            <Separator className="my-5" />

            <div>
              <p className="text-sm font-medium text-muted">About</p>
              {profile?.bio ? (
                <p className="mt-1.5 text-sm leading-relaxed text-ink whitespace-pre-line">{profile.bio}</p>
              ) : (
                <p className="mt-1.5 text-sm text-muted">No bio yet.</p>
              )}
            </div>
          </Card>

          <SpendChartCard entries={entries} loading={entriesLoading} error={entriesError} />
        </div>

        <div className="space-y-4 lg:col-span-2 lg:col-start-4">
          <Card className="px-6 py-6 sm:px-8">
            <div>
              <p className="mb-2.5 text-sm font-medium text-muted">Overview</p>
              {authUser?.uid && <ProfileOverviewStats hostId={authUser.uid} />}
            </div>

            <Separator className="my-5" />

            <ReferralsCard role="host" />

            <Separator className="my-5" />

            <div>
              <p className="mb-2 text-sm font-medium text-muted">My Location</p>
              {profile?.location ? (
                <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10 dark:invert dark:hue-rotate-180">
                  <iframe
                    title="My location"
                    width="100%"
                    height="200"
                    loading="lazy"
                    style={{ border: 0 }}
                    src={`https://maps.google.com/maps?q=${profile.location.latitude},${profile.location.longitude}&z=15&output=embed`}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted">No location set.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </JoshDiv>
  );
}
