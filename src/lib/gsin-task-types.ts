import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Task types from the admin GSIN Library (gsin_task_types). A gig stores the
// picked id as `taskTypeId`; a Cloud Function then gives it its GSINS/GSKU
// codes (admin-only — see giggre_app functions/src/gsin.ts).

export interface GsinTaskTypeOption {
  id: string;
  name: string;
  group: string; // "Category › Sub-category"
  skills: string[]; // lowercased names of linked skills (a skill can be in many task types)
}

export async function loadGsinTaskTypes(): Promise<GsinTaskTypeOption[]> {
  try {
    const [cats, subs, tasks, skills] = await Promise.all([
      getDocs(collection(db, "gsin_categories")),
      getDocs(collection(db, "gsin_subcategories")),
      getDocs(collection(db, "gsin_task_types")),
      getDocs(collection(db, "skills")),
    ]);
    const catName = new Map(cats.docs.map((d) => [d.id, String(d.data().name ?? d.id)]));
    const subName = new Map(subs.docs.map((d) => [d.id, String(d.data().name ?? d.id)]));
    const skillName = new Map<string, string>();
    const legacy = new Map<string, string[]>(); // old one-per-skill links: skills/{id}.taskTypeId
    for (const d of skills.docs) {
      const n = String(d.data().name ?? "").toLowerCase();
      skillName.set(d.id, n);
      const tt = String(d.data().taskTypeId ?? "");
      if (tt && n) legacy.set(tt, [...(legacy.get(tt) ?? []), n]);
    }
    return tasks.docs
      .map((d) => {
        const t = d.data();
        const ids: unknown[] = Array.isArray(t.skillIds) ? t.skillIds : [];
        const linked = new Set([
          ...ids.map((id) => skillName.get(String(id)) ?? "").filter(Boolean),
          ...(legacy.get(d.id) ?? []),
        ]);
        return {
          id: d.id,
          name: String(t.name ?? d.id),
          group: `${catName.get(t.categoryId) ?? t.categoryId ?? ""} › ${subName.get(t.subcategoryId) ?? t.subcategoryId ?? ""}`,
          skills: [...linked],
        };
      })
      .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
  } catch (err) {
    console.warn("[gsin] could not load task types:", err);
    return [];
  }
}

export const fitsSkill = (t: GsinTaskTypeOption, skill?: string) =>
  !!skill?.trim() && t.skills.includes(skill.trim().toLowerCase());
