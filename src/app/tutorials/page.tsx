import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { TutorialLibrary } from "@/components/TutorialVideos";

export const metadata: Metadata = {
  title: "Video Tutorials — Giggre",
  description: "Short how-to videos for Giggre: sign up, find work, post gigs, Gig Wallet and more.",
};

export default function TutorialsPage() {
  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <TutorialLibrary />
        </div>
      </main>
      <Footer />
    </>
  );
}
