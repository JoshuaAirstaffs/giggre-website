"use client";

import TitlePage from "@/components/TitlePage";
import JoshDiv from "@/components/DivAnimation";

// Shared between /app/host/settings and /app/worker/settings — blank for
// now, per explicit request, ahead of deciding what belongs here (password,
// currency/locale, notification preferences, etc.).
export default function SettingsPage() {
  return (
    <JoshDiv>
      <TitlePage title="Settings" description="Account settings" />
    </JoshDiv>
  );
}
