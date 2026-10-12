import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Mirrors ReportService's reason list and `reports` collection shape in
// giggre_app/lib/features/reports/report_service.dart.
export const REPORT_REASONS = [
  "Sexual content",
  "Harassment or bullying",
  "Hate speech",
  "Violence or threats",
  "Scam or fraud",
  "Spam",
  "Impersonation",
  "Other",
] as const;

export type ReportContentType = "user" | "gig" | "message" | "review";

export interface SubmitReportInput {
  contentType: ReportContentType;
  contentId: string;
  contentSnapshot?: string;
  surface: string;
  // Always present alongside a gig report's contentId, but also sent for
  // other content types in the mobile app (admin cross-referencing) — see
  // ReportService.show's gigId param in report_service.dart.
  gigId?: string;
  reporterId: string;
  reportedUserId: string;
  reportedUserName?: string;
  reportedUserEmail?: string;
  reason: string;
  details?: string;
}

export async function submitReport(input: SubmitReportInput): Promise<void> {
  await addDoc(collection(db, "reports"), {
    contentType: input.contentType,
    contentId: input.contentId,
    contentSnapshot: (input.contentSnapshot ?? "").slice(0, 2000),
    surface: input.surface,
    gigId: input.gigId ?? "",
    reporterId: input.reporterId,
    reportedUserId: input.reportedUserId,
    reportedUserName: input.reportedUserName ?? "",
    reportedUserEmail: input.reportedUserEmail ?? "",
    reason: input.reason,
    details: input.details ?? "",
    status: "pending",
    createdAt: serverTimestamp(),
  });
}
