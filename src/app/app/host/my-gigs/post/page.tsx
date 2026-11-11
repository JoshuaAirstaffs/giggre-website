"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles, Users, UserSearch } from "lucide-react";
import { toast } from "sonner";
import TitlePage from "@/components/TitlePage";
import JoshDiv from "@/components/DivAnimation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchGigForEdit, fetchWorkerByUid, type EditGigData, type WorkerLookupResult } from "@/lib/post-gig";
import QuickGigForm from "./components/QuickGigForm";
import OpenGigForm from "./components/OpenGigForm";
import OfferedGigForm from "./components/OfferedGigForm";

const TAB_VALUES = new Set(["quick", "open", "offered"]);
const EDIT_GIG_TYPES = new Set(["open", "offered"]);

function PostGigPageContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const workerId = searchParams.get("workerId");
  const editId = searchParams.get("editId");
  const defaultTab = tabParam && TAB_VALUES.has(tabParam) ? tabParam : "quick";
  const [preselectedWorker, setPreselectedWorker] = useState<WorkerLookupResult | null>(null);
  const [editGig, setEditGig] = useState<EditGigData | null>(null);

  // Arriving from the Favorites page's "Quick Offer" button
  // (?tab=offered&workerId=...) — re-fetch that worker fresh rather than
  // threading their whole profile through the URL.
  useEffect(() => {
    if (!workerId) return;
    let cancelled = false;
    fetchWorkerByUid(workerId)
      .then((worker) => {
        if (!cancelled) setPreselectedWorker(worker);
      })
      .catch((err) => console.error("Failed to load preselected worker:", err));
    return () => {
      cancelled = true;
    };
  }, [workerId]);

  // Arriving from a gig's detail page "Edit" button (?tab=open|offered&editId=...)
  // — fetched here (not inside the form) so OpenGigForm/OfferedGigForm, keyed
  // by editGig?.gigId below, only ever mount once this has its final value,
  // the same resolve-then-remount pattern already used for preselectedWorker.
  useEffect(() => {
    if (!editId || !tabParam || !EDIT_GIG_TYPES.has(tabParam)) return;
    let cancelled = false;
    fetchGigForEdit(tabParam as "open" | "offered", editId)
      .then((gig) => {
        if (cancelled) return;
        if (!gig) {
          toast.error("Couldn't find that gig to edit.");
          return;
        }
        setEditGig(gig);
      })
      .catch((err) => {
        console.error("Failed to load gig for editing:", err);
        if (!cancelled) toast.error("Couldn't load that gig. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [editId, tabParam]);

  return (
    <JoshDiv>
      <TitlePage
        title={editGig ? "Edit gig" : "Post a gig"}
        description={editGig ? `Editing "${editGig.title}"` : "Choose how you want to get this job done"}
      />

      <div className="mx-auto mt-6 max-w-6xl">
        <Tabs defaultValue={defaultTab}>
          <TabsList className="bg-secondary">
            <TabsTrigger value="quick" className="gap-1.5 data-active:bg-(--quick-start) data-active:text-white">
              <Sparkles className="size-3.5" />
              Quick
            </TabsTrigger>
            <TabsTrigger value="open" className="gap-1.5 data-active:bg-worker data-active:text-white">
              <Users className="size-3.5" />
              Open
            </TabsTrigger>
            <TabsTrigger value="offered" className="gap-1.5 data-active:bg-(--offered-start) data-active:text-white">
              <UserSearch className="size-3.5" />
              Offered
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="mt-4">
            <QuickGigForm />
          </TabsContent>

          <TabsContent value="open" className="mt-4">
            {/* Keyed by the resolved gig so the form mounts fresh (and seeds
                itself from editGig) once the ?editId= lookup resolves,
                instead of syncing it in via an effect after the fact. */}
            <OpenGigForm key={editGig?.gigId ?? "none"} editGig={editGig} />
          </TabsContent>

          <TabsContent value="offered" className="mt-4">
            {/* Keyed by the resolved worker/gig so the form mounts fresh (and
                seeds its selection from preselectedWorker, or every field
                from editGig) once that lookup resolves, instead of syncing
                it in via an effect after the fact. */}
            <OfferedGigForm
              key={editGig?.gigId ?? preselectedWorker?.uid ?? "none"}
              preselectedWorker={preselectedWorker}
              editGig={editGig}
            />
          </TabsContent>
        </Tabs>
      </div>
    </JoshDiv>
  );
}

export default function PostGigPage() {
  return (
    <Suspense fallback={null}>
      <PostGigPageContent />
    </Suspense>
  );
}
