import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";

// Mirrors giggre_app/lib/features/gig_host/presentation/my_documents_screen.dart
// and .../gig_worker/presentation/verification_screen.dart — same category
// keys, storage path, and Firestore shape, since a single account's
// documents/verification status is shared across both roles (isVerified is
// one flag on the user doc, not split per role).

export interface DocCategory {
  key: string;
  label: string;
  subtitle: string;
  maxFiles: number;
}

export const WORKER_DOC_CATEGORIES: DocCategory[] = [
  {
    key: "worker_valid_id",
    label: "Valid ID",
    subtitle: "Government-issued ID (e.g. Passport, Driver's License, National ID)",
    maxFiles: 2,
  },
  {
    key: "worker_skill_certificate",
    label: "Skill Certificates",
    subtitle: "Training certificates, licenses, or other credentials",
    maxFiles: 5,
  },
  { key: "worker_resume", label: "Resume / CV", subtitle: "Your latest resume or curriculum vitae", maxFiles: 1 },
  { key: "worker_other", label: "Other Documents", subtitle: "Any other supporting documents", maxFiles: 5 },
];

export const HOST_DOC_CATEGORIES: DocCategory[] = [
  {
    key: "host_valid_id",
    label: "Valid ID",
    subtitle: "Government-issued ID (e.g. Passport, Driver's License, National ID)",
    maxFiles: 2,
  },
  {
    key: "host_business_certificate",
    label: "Business Certificate",
    subtitle: "Business registration or permit documents",
    maxFiles: 3,
  },
  {
    key: "host_business_permit",
    label: "Business Permit",
    subtitle: "Local or municipal business operating permit",
    maxFiles: 2,
  },
  {
    key: "host_tax_document",
    label: "Tax Documents",
    subtitle: "Tax identification or compliance documents",
    maxFiles: 3,
  },
  { key: "host_other", label: "Other Documents", subtitle: "Any other supporting documents", maxFiles: 5 },
];

export interface UserDocument {
  docId: string;
  category: string;
  name: string;
  url: string;
  storagePath: string;
  fileSize: number;
  uploadedAt: Date | null;
}

export async function fetchUserDocuments(uid: string): Promise<UserDocument[]> {
  const snap = await getDocs(collection(db, "users", uid, "documents"));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      docId: d.id,
      category: (data.category as string) ?? "",
      name: (data.name as string) ?? "",
      url: (data.url as string) ?? "",
      storagePath: (data.storagePath as string) ?? "",
      fileSize: (data.fileSize as number | undefined) ?? 0,
      uploadedAt: (data.uploadedAt as Timestamp | undefined)?.toDate() ?? null,
    };
  });
}

export async function uploadUserDocument(uid: string, categoryKey: string, file: File): Promise<UserDocument> {
  const storagePath = `users/${uid}/documents/${categoryKey}/${file.name}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  const docRef = await addDoc(collection(db, "users", uid, "documents"), {
    category: categoryKey,
    name: file.name,
    url,
    storagePath,
    fileSize: file.size,
    uploadedAt: serverTimestamp(),
  });

  return {
    docId: docRef.id,
    category: categoryKey,
    name: file.name,
    url,
    storagePath,
    fileSize: file.size,
    uploadedAt: new Date(),
  };
}

export async function deleteUserDocument(uid: string, document: UserDocument): Promise<void> {
  await deleteObject(ref(storage, document.storagePath)).catch(() => {
    // Storage object may already be gone (or path predates this field) —
    // still remove the Firestore record either way.
  });
  await deleteDoc(doc(db, "users", uid, "documents", document.docId));
}

export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

// Requires at least one worker-category AND one host-category document,
// matching _checkUploadedDocuments in verification_screen.dart — verification
// is one flag for the whole account, not split per role.
export function canSubmitVerification(documents: UserDocument[]): boolean {
  const hasWorkerDoc = documents.some((d) => d.category.startsWith("worker_"));
  const hasHostDoc = documents.some((d) => d.category.startsWith("host_"));
  return hasWorkerDoc && hasHostDoc;
}

export async function submitVerificationRequest(
  uid: string,
  profile: { name?: string; email?: string; phone?: string; photoUrl?: string }
): Promise<void> {
  const documents = await fetchUserDocuments(uid);
  await setDoc(
    doc(db, "verification_requests", uid),
    {
      userId: uid,
      name: profile.name ?? "",
      email: profile.email ?? "",
      phone: profile.phone ?? "",
      photoUrl: profile.photoUrl ?? "",
      status: "pending",
      submittedAt: serverTimestamp(),
      reviewedAt: null,
      reviewedBy: null,
      rejectReason: null,
      attemptCount: increment(1),
      documents: documents.map((d) => ({
        category: d.category,
        name: d.name,
        url: d.url,
        storagePath: d.storagePath,
        fileSize: d.fileSize,
      })),
    },
    { merge: true }
  );
  await updateDoc(doc(db, "users", uid), { isVerified: "pending" });
}

export async function cancelVerificationRequest(uid: string): Promise<void> {
  await updateDoc(doc(db, "verification_requests", uid), {
    status: "cancelled",
    cancelledAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "users", uid), { isVerified: "unverified" });
}
