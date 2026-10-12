import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Mirrors giggre-admin's hooks/useAboutGiggre.ts and giggre_app's
// lib/screens/app_contents/about_giggre.dart — same `app_content/about_giggre2`
// doc and field names, so editing it in the admin panel updates the mobile
// app and this page together. Fields are HTML strings, already sanitized by
// the admin tool's sanitizeHtml() at write time (see useAboutGiggre.ts's
// formToDoc), so they're safe to render as markup here rather than as
// escaped plain text.
export interface AboutGiggreContent {
  mission: string;
  whatIsGiggre: string;
  howItWorks: string;
  values: string;
  website: string;
  lastUpdated: Date | null;
}

export async function getAboutGiggreContent(): Promise<AboutGiggreContent> {
  const snap = await getDoc(doc(db, "app_content", "about_giggre2"));
  const data = snap.data();
  return {
    mission: (data?.mission as string | undefined) ?? "",
    whatIsGiggre: (data?.what_is_giggre as string | undefined) ?? "",
    howItWorks: (data?.how_it_works as string | undefined) ?? "",
    values: (data?.values as string | undefined) ?? "",
    website: (data?.website as string | undefined) ?? "",
    lastUpdated: (data?.lastUpdated?.toDate?.() as Date | undefined) ?? null,
  };
}
