"use client";

import TitlePage from "@/components/TitlePage";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAppSelector } from "@/store/hooks";
import JoshDiv from "@/components/DivAnimation";
import { Briefcase, Check, InfoIcon, Mail, Pencil, Phone, ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/utils";
import RatingsCard from "./components/RatingsCard";
import SkillsCard from "./components/SkillsCard";
import ReferralsCard from "./components/ReferralsCard";
import AvailabilitySettings from "./components/AvailabilitySettings";
import EditProfileDialog from "./components/EditProfileDialog";
import { Button } from "@/components/ui/button";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"

function MetaItem({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-muted">
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{children}</span>
    </div>
  );
}

export default function WorkerProfilePage() {
  const { authUser, profile } = useAppSelector((root) => root.user);
  const name = profile?.name ?? authUser?.displayName ?? "";
  const initials = name.slice(0, 2).toUpperCase() || "?";
  const photoUrl = profile?.photoUrl;
  const isVerified = profile?.isVerified === "verified";
  const completedGigs = profile?.earnings?.completedGigs ?? 0;

  return (
    <JoshDiv>
      <div className="flex items-center justify-between">
        <TitlePage title="Profile" description="View and manage your profile information" />
        <EditProfileDialog>
          <Button variant="outline" size="sm">
            <Pencil className="size-3.5" />
            Edit Profile
          </Button>
        </EditProfileDialog>
      </div>

      {!isVerified && (
        <Alert className="my-6 max-w-xl border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50">
          <InfoIcon />
          <AlertTitle>Account not verified</AlertTitle>
          <AlertDescription className="py-2">
            Upload a valid ID for both worker and host as proof before requesting verification from admin.
          </AlertDescription>
          <AlertAction>
            <Button size="xs" variant="default" className="bg-(--worker-end)">
              Go to My Documents
            </Button>
          </AlertAction>
        </Alert>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card className="px-6 py-6 sm:px-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <Avatar className="size-20 shrink-0 ring-2 ring-(--worker-start)/25 ring-offset-2 ring-offset-card">
                <AvatarImage src={photoUrl || undefined} alt={name} />
                <AvatarFallback className="rounded-full bg-(--worker-end) text-2xl text-sidebar-primary-foreground">
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
                  <h2 className="text-xl font-bold text-ink">{name}</h2>
                  {isVerified && (
                    <Badge className="gap-1 bg-(--success-tint) text-(--success-text)">
                      <ShieldCheck className="size-3" />
                      Verified
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                  {profile?.email && <MetaItem icon={Mail}>{profile.email}</MetaItem>}
                  {profile?.phone && <MetaItem icon={Phone}>{profile.phone}</MetaItem>}
                  <MetaItem icon={Briefcase}>
                    {completedGigs} gig{completedGigs === 1 ? "" : "s"} completed
                  </MetaItem>
                  <p className="text-sm text-muted">Member since {formatDate(profile?.createdAt)}</p>
                </div>
              </div>
            </div>

            <Separator className="my-5" />

            <div>
              <p className="text-sm font-medium text-muted">About</p>
              {profile?.bio ? (
                <p className="mt-1.5 text-sm leading-relaxed text-ink">{profile.bio}</p>
              ) : (
                <p className="mt-1.5 text-sm text-muted">No bio yet.</p>
              )}
            </div>

            <Separator className="my-5" />

            <AvailabilitySettings />
          </Card>

          <div className="mt-6">
            <SkillsCard />
          </div>
        </div>

        <div className="lg:col-span-2 lg:col-start-4">
          <Card className="px-6 py-6 sm:px-8">
            <RatingsCard />

            <Separator className="my-5" />

            <ReferralsCard />

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
