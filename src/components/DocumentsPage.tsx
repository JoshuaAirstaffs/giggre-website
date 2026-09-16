"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Award,
  Building2,
  CircleCheck,
  CircleX,
  Clock,
  ExternalLink,
  FileText,
  Folder,
  IdCard,
  InfoIcon,
  Receipt,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import TitlePage from "@/components/TitlePage";
import JoshDiv from "@/components/DivAnimation";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppSelector } from "@/store/hooks";
import {
  HOST_DOC_CATEGORIES,
  WORKER_DOC_CATEGORIES,
  canSubmitVerification,
  cancelVerificationRequest,
  deleteUserDocument,
  fetchUserDocuments,
  submitVerificationRequest,
  uploadUserDocument,
  type DocCategory,
  type UserDocument,
} from "@/lib/documents";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  worker_valid_id: IdCard,
  worker_skill_certificate: Award,
  worker_resume: FileText,
  worker_other: Folder,
  host_valid_id: IdCard,
  host_business_certificate: Building2,
  host_business_permit: ShieldCheck,
  host_tax_document: Receipt,
  host_other: Folder,
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function CategoryGrid({
  title,
  categories,
  documents,
  onSelect,
}: {
  title: string;
  categories: DocCategory[];
  documents: UserDocument[];
  onSelect: (category: DocCategory) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-muted">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((category) => {
          const count = documents.filter((d) => d.category === category.key).length;
          const Icon = CATEGORY_ICONS[category.key] ?? Folder;
          return (
            <button key={category.key} type="button" onClick={() => onSelect(category)} className="text-left">
              <Card className="h-full gap-2 p-4 transition-colors hover:bg-accent">
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-secondary">
                    <Icon className="size-4.5 text-muted-foreground" />
                  </div>
                  <span className="text-xs text-muted">
                    {count}/{category.maxFiles}
                  </span>
                </div>
                <p className="text-sm font-medium text-ink">{category.label}</p>
                <p className="line-clamp-2 text-xs text-muted">{category.subtitle}</p>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Shared between /app/host/documents and /app/worker/documents — a single
// account's uploaded documents and isVerified status apply to both roles
// (see submitVerificationRequest's canSubmitVerification, which requires one
// worker-category AND one host-category doc regardless of which role is
// currently viewing this page).
export default function DocumentsPage() {
  const { authUser, profile } = useAppSelector((root) => root.user);
  const uid = authUser?.uid;
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<DocCategory | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const fetched = await fetchUserDocuments(uid);
        if (!cancelled) {
          setDocuments(fetched);
          setError(null);
        }
      } catch (err) {
        console.error("Failed to load documents:", err);
        if (!cancelled) setError("Couldn't load your documents. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const isVerified = profile?.isVerified ?? "unverified";
  const canSubmit = canSubmitVerification(documents);

  async function handleUpload(file: File) {
    if (!uid || !activeCategory) return;
    setUploading(true);
    try {
      const uploaded = await uploadUserDocument(uid, activeCategory.key, file);
      setDocuments((prev) => [...prev, uploaded]);
      toast.success(`${file.name} uploaded`);
    } catch (err) {
      console.error("Failed to upload document:", err);
      toast.error("Couldn't upload that file. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(document: UserDocument) {
    if (!uid) return;
    try {
      await deleteUserDocument(uid, document);
      setDocuments((prev) => prev.filter((d) => d.docId !== document.docId));
    } catch (err) {
      console.error("Failed to delete document:", err);
      toast.error("Couldn't delete that file. Please try again.");
    }
  }

  async function handleSubmitVerification() {
    if (!uid) return;
    setSubmitting(true);
    try {
      await submitVerificationRequest(uid, {
        name: profile?.name,
        email: profile?.email,
        phone: profile?.phone,
        photoUrl: profile?.photoUrl,
      });
      toast.success("Verification request submitted!");
    } catch (err) {
      console.error("Failed to submit verification request:", err);
      toast.error("Couldn't submit your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelVerification() {
    if (!uid) return;
    setSubmitting(true);
    try {
      await cancelVerificationRequest(uid);
      toast.success("Verification request cancelled.");
    } catch (err) {
      console.error("Failed to cancel verification request:", err);
      toast.error("Couldn't cancel your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const activeDocuments = activeCategory ? documents.filter((d) => d.category === activeCategory.key) : [];
  const atCapacity = activeCategory ? activeDocuments.length >= activeCategory.maxFiles : false;

  return (
    <JoshDiv>
      <TitlePage title="My Documents" description="Upload your ID and supporting documents to get verified" />

      {isVerified === "verified" ? (
        <Alert className="my-6 max-w-2xl border-(--success-tint) bg-(--success-tint) text-(--success-text)">
          <CircleCheck />
          <AlertTitle>Account verified</AlertTitle>
          <AlertDescription className="py-1">You&apos;re all set — your account is verified.</AlertDescription>
        </Alert>
      ) : isVerified === "pending" ? (
        <Alert className="my-6 max-w-2xl border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50">
          <Clock />
          <AlertTitle>Verification pending</AlertTitle>
          <AlertDescription className="py-2">
            Your request is being reviewed. This usually takes a few business days.
          </AlertDescription>
          <AlertAction>
            <Button size="xs" variant="outline" disabled={submitting} onClick={handleCancelVerification}>
              Cancel Request
            </Button>
          </AlertAction>
        </Alert>
      ) : (
        <Alert
          className={
            isVerified === "rejected"
              ? "my-6 max-w-2xl border-(--danger-tint) bg-(--danger-tint) text-(--danger-text)"
              : "my-6 max-w-2xl border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50"
          }
        >
          {isVerified === "rejected" ? <CircleX /> : <InfoIcon />}
          <AlertTitle>{isVerified === "rejected" ? "Verification rejected" : "Account not verified"}</AlertTitle>
          <AlertDescription className="py-2">
            {isVerified === "rejected"
              ? "Your previous request was rejected. Update your documents and resubmit."
              : "Upload a valid ID for both worker and host as proof before requesting verification from admin."}
          </AlertDescription>
          <AlertAction>
            <Button size="xs" disabled={!canSubmit || submitting} onClick={handleSubmitVerification}>
              {isVerified === "rejected" ? "Resubmit Verification Request" : "Submit Verification Request"}
            </Button>
          </AlertAction>
        </Alert>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <div className="space-y-6">
          <CategoryGrid
            title="Worker Documents"
            categories={WORKER_DOC_CATEGORIES}
            documents={documents}
            onSelect={setActiveCategory}
          />
          <CategoryGrid
            title="Host Documents"
            categories={HOST_DOC_CATEGORIES}
            documents={documents}
            onSelect={setActiveCategory}
          />
        </div>
      )}

      <Sheet open={activeCategory !== null} onOpenChange={(open) => !open && setActiveCategory(null)}>
        <SheetContent>
          {activeCategory && (
            <>
              <SheetHeader>
                <SheetTitle>{activeCategory.label}</SheetTitle>
                <SheetDescription>{activeCategory.subtitle}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-1 flex-col gap-3 px-4 pb-4">
                {activeDocuments.length === 0 ? (
                  <p className="text-sm text-muted">No files uploaded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {activeDocuments.map((document) => (
                      <div
                        key={document.docId}
                        className="flex items-center gap-2 rounded-lg border border-hairline px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{document.name}</p>
                          <p className="text-xs text-muted">{formatBytes(document.fileSize)}</p>
                        </div>
                        <a
                          href={document.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`View ${document.name}`}
                          className="text-muted-foreground hover:text-ink"
                        >
                          <ExternalLink className="size-4" />
                        </a>
                        <button
                          type="button"
                          aria-label={`Delete ${document.name}`}
                          onClick={() => handleDelete(document)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                  }}
                />
                <Button
                  variant="outline"
                  className="mt-auto w-full gap-1.5"
                  disabled={atCapacity || uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-3.5" />
                  {uploading ? "Uploading…" : atCapacity ? "Limit reached" : "Add Document"}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </JoshDiv>
  );
}
