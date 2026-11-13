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

// Mirrors SkillIconService in skill_icon_service.dart: a skill's icon is
// whichever GSIN sub-category it maps to via a task type (skillIds, plus the
// legacy one-per-skill taskTypeId), using `gsin_subcategories/{id}.icon` (an
// Iconify name like "material-symbols:pets") rendered through Iconify's
// public API. When a skill reaches several sub-categories with icons, the
// first by sub-category name (case-insensitive) wins, same tie-break.
function iconifyUrl(icon: unknown): string | null {
  if (typeof icon !== "string") return null;
  const m = /^([a-z0-9-]+):([a-z0-9-]+)$/.exec(icon.trim());
  return m ? `https://api.iconify.design/${m[1]}/${m[2]}.svg` : null;
}

let skillIconsCache: Map<string, string> | null = null;
let skillIconsLoading: Promise<Map<string, string>> | null = null;

/** Lowercased, trimmed skill name → Iconify SVG URL. Loads once per session. */
export function loadSkillIcons(): Promise<Map<string, string>> {
  if (skillIconsCache) return Promise.resolve(skillIconsCache);
  if (skillIconsLoading) return skillIconsLoading;
  skillIconsLoading = (async () => {
    try {
      const [skills, taskTypes, subcategories] = await Promise.all([
        getDocs(collection(db, "skills")),
        getDocs(collection(db, "gsin_task_types")),
        getDocs(collection(db, "gsin_subcategories")),
      ]);

      const subIcon = new Map<string, { name: string; url: string }>();
      for (const d of subcategories.docs) {
        const url = iconifyUrl(d.data().icon);
        if (url) subIcon.set(d.id, { name: String(d.data().name ?? d.id), url });
      }

      const taskSub = new Map<string, string>();
      const skillTaskTypes = new Map<string, Set<string>>();
      for (const d of taskTypes.docs) {
        const t = d.data();
        if (typeof t.subcategoryId === "string" && t.subcategoryId) taskSub.set(d.id, t.subcategoryId);
        const ids: unknown[] = Array.isArray(t.skillIds) ? t.skillIds : [];
        for (const id of ids) {
          const key = String(id);
          let set = skillTaskTypes.get(key);
          if (!set) {
            set = new Set();
            skillTaskTypes.set(key, set);
          }
          set.add(d.id);
        }
      }

      const map = new Map<string, string>();
      for (const d of skills.docs) {
        const name = d.data().name;
        if (typeof name !== "string" || !name.trim()) continue;
        const types = new Set(skillTaskTypes.get(d.id) ?? []);
        const legacy = d.data().taskTypeId;
        if (typeof legacy === "string" && legacy) types.add(legacy);

        let best: { name: string; url: string } | null = null;
        for (const t of types) {
          const sub = taskSub.get(t);
          const candidate = sub ? subIcon.get(sub) : undefined;
          if (candidate && (!best || candidate.name.toLowerCase() < best.name.toLowerCase())) best = candidate;
        }
        if (best) map.set(name.trim().toLowerCase(), best.url);
      }

      skillIconsCache = map;
      return map;
    } catch (err) {
      console.warn("[gsin] could not load skill icons:", err);
      return new Map();
    } finally {
      skillIconsLoading = null;
    }
  })();
  return skillIconsLoading;
}
