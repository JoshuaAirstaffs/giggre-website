"use client";

import { useState } from "react";
import { Mode } from "@/lib/content";
import Header from "./Header";
import Hero from "./Hero";
import AppPreview from "./AppPreview";
import HowItWorks from "./HowItWorks";
import LocalProof from "./LocalProof";
import DownloadCTA from "./DownloadCTA";
import Footer from "./Footer";

export default function HomeClient() {
  const [mode, setMode] = useState<Mode>("worker");

  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero mode={mode} setMode={setMode} />
        <AppPreview mode={mode} />
        <HowItWorks mode={mode} />
        <LocalProof />
        <DownloadCTA />
      </main>
      <Footer />
    </>
  );
}
