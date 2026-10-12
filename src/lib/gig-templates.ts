import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ActionResult } from "@/lib/browse-gigs";
import type { ExperienceLevel, PayType } from "@/lib/post-gig";

// Mirrors giggre_app's gig_template_model.dart exactly — same collection
// and field names, verified against the actual Dart source (not guessed),
// since this collection is shared with the mobile app. One quirk worth
// flagging: the template doc's skill field is a single `skillRequired`
// string for BOTH open and offered templates — unlike an open gig doc
// itself, which stores `requiredSkills` as an array. Translating between
// the two is the caller's job (see saveGigTemplate's input shape below and
// the Use-template prefill mapping in templates/page.tsx).
export interface GigTemplate {
  id: string;
  hostId: string;
  gigType: "quick" | "open" | "offered";
  name: string;
  title: string;
  description: string;
  budget: number;
  currencyCode: string;
  skillRequired?: string; // open/offered only
  experienceLevel?: ExperienceLevel; // open/offered only
  payType: PayType;
  hourlyRate?: number | null;
  workDurationHours?: number;
  workerSlots: number;
  createdAt: Date | null;
}

export interface SaveGigTemplateInput {
  hostId: string;
  name: string;
  gigType: "quick" | "open" | "offered";
  title: string;
  description: string;
  budget: number;
  currencyCode: string;
  skillRequired?: string;
  experienceLevel?: ExperienceLevel;
  payType: PayType;
  hourlyRate?: number | null;
  workDurationHours?: number;
  workerSlots: number;
}

function toGigTemplate(id: string, data: Record<string, unknown>): GigTemplate {
  return {
    id,
    hostId: (data.hostId as string | undefined) ?? "",
    gigType: (data.gigType as GigTemplate["gigType"]) ?? "open",
    name: (data.name as string | undefined) ?? "",
    title: (data.title as string | undefined) ?? "",
    description: (data.description as string | undefined) ?? "",
    budget: (data.budget as number | undefined) ?? 0,
    currencyCode: (data.currencyCode as string | undefined) ?? "USD",
    skillRequired: data.skillRequired as string | undefined,
    experienceLevel: data.experienceLevel as ExperienceLevel | undefined,
    payType: (data.payType as PayType | undefined) ?? "flat",
    hourlyRate: (data.hourlyRate as number | undefined) ?? null,
    workDurationHours: data.workDurationHours as number | undefined,
    workerSlots: (data.workerSlots as number | undefined) ?? 1,
    createdAt: (data.createdAt as Timestamp | undefined)?.toDate() ?? null,
  };
}

// No orderBy combined with the where() here would need a composite index —
// sorted client-side instead, same convention as subscribeChatRooms.
export function subscribeGigTemplates(
  hostId: string,
  onData: (templates: GigTemplate[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "gig_templates"), where("hostId", "==", hostId)),
    (snap) => {
      const templates = snap.docs.map((d) => toGigTemplate(d.id, d.data()));
      templates.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
      onData(templates);
    },
    onError
  );
}

export async function saveGigTemplate(input: SaveGigTemplateInput): Promise<ActionResult> {
  try {
    await addDoc(collection(db, "gig_templates"), {
      hostId: input.hostId,
      gigType: input.gigType,
      name: input.name,
      title: input.title,
      description: input.description,
      budget: input.budget,
      currencyCode: input.currencyCode,
      ...(input.skillRequired ? { skillRequired: input.skillRequired } : {}),
      ...(input.experienceLevel ? { experienceLevel: input.experienceLevel } : {}),
      payType: input.payType,
      hourlyRate: input.hourlyRate ?? null,
      ...(input.workDurationHours !== undefined ? { workDurationHours: input.workDurationHours } : {}),
      workerSlots: input.workerSlots,
      createdAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Couldn't save this template." };
  }
}

export async function deleteGigTemplate(templateId: string): Promise<ActionResult> {
  try {
    await deleteDoc(doc(db, "gig_templates", templateId));
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Couldn't delete this template." };
  }
}
