import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AboutContent from "@/components/AboutContent";
import { getAboutGiggreContent } from "@/lib/aboutContent";

export const metadata: Metadata = {
  title: "About — Giggre",
  description: "What Giggre is, how it works, and the values behind it.",
};

export const revalidate = 3600;

export default async function AboutPage() {
  const content = await getAboutGiggreContent();

  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <AboutContent content={content} />
        </div>
      </main>
      <Footer />
    </>
  );
}
