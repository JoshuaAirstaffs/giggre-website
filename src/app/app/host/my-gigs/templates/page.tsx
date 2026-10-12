"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Bookmark, Trash2 } from "lucide-react";
import TitlePage from "@/components/TitlePage";
import JoshDiv from "@/components/DivAnimation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAppSelector } from "@/store/hooks";
import { capitalize, payLabel } from "@/lib/gig-format";
import { formatDate } from "@/lib/utils";
import { GIG_TYPE_BADGE_CLASSES } from "@/lib/earnings";
import { deleteGigTemplate, subscribeGigTemplates, type GigTemplate } from "@/lib/gig-templates";
import { setPostAgainPrefill } from "@/lib/post-again";

export default function SavedTemplatesPage() {
  const uid = useAppSelector((root) => root.user.authUser?.uid);
  const router = useRouter();
  const [templates, setTemplates] = useState<GigTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GigTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!uid) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const unsubscribe = subscribeGigTemplates(
      uid,
      (fetched) => {
        setTemplates(fetched);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Failed to load templates:", err);
        setError("Couldn't load your saved templates.");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [uid]);

  // Same one-shot prefill mechanism "Post Again" uses (post-again.ts) —
  // schedule always starts blank, same principle: never assume an old date
  // is still valid.
  function handleUse(template: GigTemplate) {
    setPostAgainPrefill({
      gigType: template.gigType,
      title: template.title,
      description: template.description,
      payType: template.payType,
      amount: template.payType === "hourly" ? (template.hourlyRate ?? template.budget) : template.budget,
      workDurationHours: template.workDurationHours,
      workerSlots: template.workerSlots,
      requiredSkill: template.gigType === "open" ? template.skillRequired : undefined,
      skillRequired: template.gigType === "offered" ? template.skillRequired : undefined,
      experienceLevel: template.experienceLevel,
    });
    router.push(`/app/host/my-gigs/post?tab=${template.gigType}`);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deleteGigTemplate(deleteTarget.id);
      if (result.ok) {
        toast.success("Template deleted.");
        setDeleteTarget(null);
      } else {
        toast.error(result.reason);
      }
    } catch (err) {
      console.error("Failed to delete template:", err);
      toast.error("Couldn't delete this template. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <JoshDiv>
      <Button
        variant="ghost"
        size="sm"
        className="mb-2 -ml-2 gap-1.5"
        render={<Link href="/app/host/my-gigs" />}
        nativeButton={false}
      >
        <ArrowLeft className="size-4" />
        Back to My Gigs
      </Button>

      <TitlePage title="Saved Templates" description="Reusable gig setups — never a specific date or worker" />

      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-hairline py-16 text-center">
            <Bookmark className="size-10 text-muted" />
            <p className="font-medium text-ink">No saved templates yet</p>
            <p className="text-sm text-muted">
              Save a gig as a template from its detail page or the My Gigs table to reuse its setup later.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-hairline">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Pay</TableHead>
                  <TableHead>Date Saved</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium text-ink">{template.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={GIG_TYPE_BADGE_CLASSES[template.gigType]}>
                        {capitalize(template.gigType)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-muted">{template.title}</TableCell>
                    <TableCell>{payLabel(template.currencyCode, template)}</TableCell>
                    <TableCell className="text-muted">{formatDate(template.createdAt ?? undefined)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleUse(template)}>
                          Use
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Delete template"
                          onClick={() => setDeleteTarget(template)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{deleteTarget?.name}&quot;? This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep</AlertDialogCancel>
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </JoshDiv>
  );
}
