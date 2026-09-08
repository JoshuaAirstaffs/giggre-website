import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  Timestamp,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";

// Mirrors giggre_app/lib/features/gig_worker/presentation/widgets/toolchest_sheet.dart
// and skill_request_form.dart — same collections, field names, and status
// vocabulary so admin tooling built against the mobile app's schema keeps working.

export const SKILL_CATEGORIES = [
  "Technical",
  "Creative",
  "Hospitality",
  "Delivery",
  "Cleaning",
  "Construction",
  "Admin",
  "Others",
] as const;

export const EXPERIENCE_LEVELS = ["Entry Level", "Intermediate", "Expert"] as const;

/** Auto-derives experience level from years, matching skill_request_form.dart's `_updateLevelFromYears`. */
export function levelFromYears(years: number | null): (typeof EXPERIENCE_LEVELS)[number] | null {
  if (years === null || Number.isNaN(years)) return null;
  if (years >= 6) return "Expert";
  if (years >= 3) return "Intermediate";
  return "Entry Level";
}

export interface SkillCatalogItem {
  skillDocId: string;
  skillId: string;
  name: string;
  category: string;
  description: string;
}

export async function fetchSkillsCatalog(): Promise<SkillCatalogItem[]> {
  const snap = await getDocs(query(collection(db, "skills"), orderBy("name")));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      skillDocId: d.id,
      skillId: (data.skillId as string | undefined) ?? d.id,
      name: (data.name as string | undefined) ?? "",
      category: (data.category as string | undefined) ?? "",
      description: (data.description as string | undefined) ?? "",
    };
  });
}

export interface SkillRequest {
  id: string;
  skillName: string;
  skillCategory: string;
  status: string;
  adminRemarks: string;
  createdAt: Date | null;
  proofCount: number;
  experienceLevel: string;
}

export async function fetchSkillRequests(uid: string): Promise<SkillRequest[]> {
  const snap = await getDocs(query(collection(db, "skill_requests"), where("userId", "==", uid)));
  return snap.docs
    .map((d) => {
      const data = d.data();
      const createdAt = data.createdAt as Timestamp | undefined;
      return {
        id: d.id,
        skillName: (data.skillName as string | undefined) ?? "",
        skillCategory: (data.skillCategory as string | undefined) ?? "",
        status: (data.status as string | undefined) ?? "pending",
        adminRemarks: (data.adminRemarks as string | undefined) ?? "",
        createdAt: createdAt?.toDate() ?? null,
        proofCount: (data.proofUrls as unknown[] | undefined)?.length ?? 0,
        experienceLevel: (data.experienceLevel as string | undefined) ?? "",
      };
    })
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

/**
 * Returns the most recent non-rejected request status for a skill name, or
 * "" if there's no active request — matches `_requestStatusForSkill`.
 */
export function requestStatusForSkill(requests: SkillRequest[], skillName: string): string {
  const key = skillName.toLowerCase().trim();
  const match = requests.find((r) => r.skillName.toLowerCase().trim() === key);
  return match?.status ?? "";
}

/**
 * Grants skillsXP (level 1) for any approved request whose skill isn't
 * already in skillsXP — matches `_syncApprovedSkillsToXP`. Returns the
 * newly-granted names so the caller can also reflect them in local state
 * (e.g. Redux) without waiting for a full profile refetch.
 */
export async function syncApprovedSkillsToXP(
  uid: string,
  requests: SkillRequest[],
  skillsXP: Record<string, number>
): Promise<Record<string, number>> {
  const approvedNames = new Set(
    requests.filter((r) => r.status === "approved" && r.skillName).map((r) => r.skillName)
  );
  if (approvedNames.size === 0) return {};

  const existingLower = new Set(Object.keys(skillsXP).map((k) => k.toLowerCase().trim()));
  const granted: Record<string, number> = {};
  for (const name of approvedNames) {
    if (!existingLower.has(name.toLowerCase().trim())) {
      granted[name] = 1;
    }
  }
  if (Object.keys(granted).length === 0) return {};

  const updates: Record<string, number> = {};
  for (const name of Object.keys(granted)) {
    updates[`skillsXP.${name}`] = 1;
  }
  await updateDoc(doc(db, "users", uid), updates);
  return granted;
}

export const STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  rejected: "Rejected",
  under_review: "Under Review",
  need_more_info: "Needs More Info",
  pending: "Pending",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? "Pending";
}

export const STATUS_BADGE_CLASSES: Record<string, string> = {
  approved: "bg-(--success-tint) text-(--success-text)",
  rejected: "bg-(--danger-tint) text-(--danger-text)",
  under_review: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  need_more_info: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  pending: "bg-(--quick-tint) text-(--quick-text)",
};

export interface SkillRequestInput {
  uid: string;
  gigWorkerId: string;
  userName: string;
  userEmail: string;
  skillId: string;
  skillDocId: string;
  skillName: string;
  skillCategory: string;
  reason: string;
  experienceLevel: string;
  years: string;
  months: string;
  proofFiles: File[];
  relatedExperience: string;
  suggestedRequirement: string;
  contactAvailability: string;
}

export async function submitSkillRequest(input: SkillRequestInput): Promise<void> {
  const proofUrls: string[] = [];
  const proofPaths: string[] = [];
  const proofNames: string[] = [];

  for (const file of input.proofFiles) {
    const path = `skill_requests/${input.uid}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    proofUrls.push(await getDownloadURL(storageRef));
    proofPaths.push(path);
    proofNames.push(file.name);
  }

  await addDoc(collection(db, "skill_requests"), {
    userId: input.uid,
    gigWorkerId: input.gigWorkerId,
    skillId: input.skillId,
    skill_req_Id: input.skillDocId,
    userName: input.userName,
    userEmail: input.userEmail,
    skillName: input.skillName,
    skillCategory: input.skillCategory,
    reason: input.reason,
    experienceLevel: input.experienceLevel,
    experienceDuration: `${input.years} year/s and ${input.months} month/s`,
    proofUrls,
    proofPaths,
    proofNames,
    relatedExperience: input.relatedExperience,
    suggestedRequirement: input.suggestedRequirement,
    contactAvailability: input.contactAvailability,
    status: "pending",
    adminRemarks: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
