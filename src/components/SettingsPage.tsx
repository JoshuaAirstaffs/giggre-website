"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldOff, Trash2 } from "lucide-react";
import TitlePage from "@/components/TitlePage";
import JoshDiv from "@/components/DivAnimation";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Shared between /app/host/settings and /app/worker/settings — mirrors the
// "Account" section of worker_settings_screen.dart in the Flutter app
// (Blocked Users + Delete Account are the only two entries there beyond
// dark mode, which this app already exposes globally via the header's
// ThemeToggle, and worker-only decline/matching info, which isn't
// applicable to a shared host+worker settings page).
export default function SettingsPage() {
  const pathname = usePathname();
  const basePath = pathname.startsWith("/app/host") ? "/app/host" : "/app/worker";

  return (
    <JoshDiv>
      <TitlePage title="Settings" description="Account settings" />

      <div className="mt-6 space-y-4">
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
