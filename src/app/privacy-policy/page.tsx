import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LegalContent from "@/components/LegalContent";
import { getContentSection } from "@/lib/appContent";

export const metadata: Metadata = {
  title: "Privacy Policy — Giggre",
  description: "How Giggre collects, uses, and protects your data.",
};

export const revalidate = 3600;

export default async function PrivacyPolicyPage() {
  const { items, lastUpdated } = await getContentSection("privacy");

  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <LegalContent
            badgeLabel="Privacy Policy"
            badgeIcon={
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            heading="How we handle your data."
            items={items}
            lastUpdated={lastUpdated}
            contactBlurb="Questions about this policy? Reach out at"
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
