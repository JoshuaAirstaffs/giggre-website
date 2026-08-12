import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LegalContent from "@/components/LegalContent";
import { getContentSection } from "@/lib/appContent";

export const metadata: Metadata = {
  title: "Terms of Service — Giggre",
  description: "The ground rules for using Giggre.",
};

export const revalidate = 3600;

export default async function TermsPage() {
  const { items,  lastUpdated } = await getContentSection("terms_and_conditions");

  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <LegalContent
            badgeLabel="Terms of Service"
            badgeIcon={
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 3h6l1 3h4v2h-1.5l-3 8a3 3 0 0 1-5 0l-3-8H5V6h4l1-3Z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 21h6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            heading="The ground rules for using Giggre."
            // Content is still being drafted — hide the cards for now, keep
            // the badge/title/last-updated date visible. items={items}
            items={items}
            lastUpdated={lastUpdated}
            contactBlurb="Questions about these terms? Reach out at"
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
