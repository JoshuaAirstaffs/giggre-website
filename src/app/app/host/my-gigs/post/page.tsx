"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles, Users, UserSearch } from "lucide-react";
import TitlePage from "@/components/TitlePage";
import JoshDiv from "@/components/DivAnimation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchWorkerByUid, type WorkerLookupResult } from "@/lib/post-gig";
import QuickGigForm from "./components/QuickGigForm";
import OpenGigForm from "./components/OpenGigForm";
import OfferedGigForm from "./components/OfferedGigForm";

const TAB_VALUES = new Set(["quick", "open", "offered"]);

function PostGigPageContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const workerId = searchParams.get("workerId");
  const defaultTab = tabParam && TAB_VALUES.has(tabParam) ? tabParam : "quick";
  const [preselectedWorker, setPreselectedWorker] = useState<WorkerLookupResult | null>(null);

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

  return (
    <JoshDiv>
      <TitlePage title="Post a gig" description="Choose how you want to get this job done" />

      <div className="mt-6 max-w-6xl">
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
            <OpenGigForm />
          </TabsContent>

          <TabsContent value="offered" className="mt-4">
            {/* Keyed by the resolved worker so the form mounts fresh (and
                seeds its selection from preselectedWorker) once the
                ?workerId= lookup resolves, instead of syncing it in via an
                effect after the fact. */}
            <OfferedGigForm key={preselectedWorker?.uid ?? "none"} preselectedWorker={preselectedWorker} />
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
