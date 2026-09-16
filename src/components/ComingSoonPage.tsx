"use client";

import TitlePage from "@/components/TitlePage";
import JoshDiv from "@/components/DivAnimation";

// Generic placeholder for a page whose real implementation exists but isn't
// wired in yet — used instead of deleting/hiding that work, so it's clear
// from the route file itself that a page is intentionally unfinished rather
// than broken.
export default function ComingSoonPage({ title, description }: { title: string; description: string }) {
  return (
    <JoshDiv>
      <TitlePage title={title} description={description} />
    </JoshDiv>
  );
}
