import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type ContentItem = {
  id: string;
  title: string;
  body: string;
  sortNumber: number;
};

export type ContentSection = {
  items: ContentItem[];
  lastUpdated: Date | null;
};

// Mirrors giggre-admin's content model: app_content/{sectionKey} holds section
// metadata (lastUpdated), app_content/{sectionKey}/items holds the visible
// content — an item with sortNumber <= 0 exists in Firestore but is hidden.
export async function getContentSection(sectionKey: string): Promise<ContentSection> {
  const sectionSnap = await getDoc(doc(db, "app_content", sectionKey));
  const lastUpdated = sectionSnap.exists()
    ? (sectionSnap.data().lastUpdated?.toDate?.() ?? null)
    : null;

  const itemsSnap = await getDocs(collection(db, "app_content", sectionKey, "items"));
  const items = itemsSnap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: (data.title as string) ?? "",
        body: (data.body as string) ?? "",
        sortNumber: Number(data.sortNumber ?? 0),
      };
    })
    .filter((item) => item.sortNumber > 0)
    .sort((a, b) => a.sortNumber - b.sortNumber);

  return { items, lastUpdated };
}
