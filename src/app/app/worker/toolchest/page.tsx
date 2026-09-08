"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Search, Sparkles, Wrench } from "lucide-react";
import TitlePage from "@/components/TitlePage";
import JoshDiv from "@/components/DivAnimation";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { mergeProfile } from "@/store/userSlice";
import {
  fetchSkillRequests,
  fetchSkillsCatalog,
  syncApprovedSkillsToXP,
  type SkillCatalogItem,
  type SkillRequest,
} from "@/lib/toolchest";
import MySkillsTab from "./components/MySkillsTab";
import RequestsTab from "./components/RequestsTab";
import BrowseSkillsTab from "./components/BrowseSkillsTab";
import SkillRequestDialog from "./components/SkillRequestDialog";

const ACTIVE_TAB_CLASSES = "gap-1.5 data-active:bg-(--worker-end) data-active:text-white";

function CountPill({ count }: { count: number }) {
  return (
    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-current/15 px-1 text-[10px] font-bold text-current">
      {count}
    </span>
  );
}

export default function ToolchestPage() {
  const dispatch = useAppDispatch();
  const uid = useAppSelector((root) => root.user.authUser?.uid);
  const skillsXP = useAppSelector((root) => root.user.profile?.skillsXP);

  const [requests, setRequests] = useState<SkillRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [catalog, setCatalog] = useState<SkillCatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogSkill, setDialogSkill] = useState<SkillCatalogItem | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [requestsVersion, setRequestsVersion] = useState(0);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      setLoadingRequests(true);
      try {
        const fetched = await fetchSkillRequests(uid);
        if (cancelled) return;
        setRequests(fetched);
        const granted = await syncApprovedSkillsToXP(uid, fetched, skillsXP ?? {});
        if (!cancelled && Object.keys(granted).length > 0) {
          dispatch(mergeProfile({ skillsXP: { ...(skillsXP ?? {}), ...granted } }));
        }
      } catch (err) {
        console.error("Failed to load skill requests:", err);
      } finally {
        if (!cancelled) setLoadingRequests(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // skillsXP is read once per run to seed the sync check, not a trigger —
    // re-running on every skillsXP change (which this effect itself causes)
    // would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, requestsVersion]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      setLoadingCatalog(true);
      try {
        const fetched = await fetchSkillsCatalog();
        if (!cancelled) setCatalog(fetched);
      } catch (err) {
        console.error("Failed to load skills catalog:", err);
      } finally {
        if (!cancelled) setLoadingCatalog(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const skillCount = Object.keys(skillsXP ?? {}).length;
  const activeRequestCount = requests.filter((r) => r.status !== "approved" && r.status !== "rejected").length;
  const availableCount = useMemo(() => {
    const owned = new Set(Object.keys(skillsXP ?? {}).map((k) => k.toLowerCase().trim()));
    return catalog.filter((s) => !owned.has(s.name.toLowerCase().trim())).length;
  }, [catalog, skillsXP]);

  function openNewRequest() {
    setDialogSkill(null);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  function openApplyRequest(skill: SkillCatalogItem) {
    setDialogSkill(skill);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  return (
    <JoshDiv>
      <TitlePage title="My Toolchest" description="Manage your skills & applications" />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="px-6 py-5">
          <CardContent className="flex items-center gap-3 p-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-(--quick-tint) text-(--quick-text)">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted">Skills Owned</p>
              <p className="text-xl font-bold text-ink">{skillCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="px-6 py-5">
          <CardContent className="flex items-center gap-3 p-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-(--worker-tint) text-(--worker-text)">
              <ClipboardList className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted">Active Requests</p>
              {loadingRequests ? (
                <Skeleton className="mt-1 h-6 w-8" />
              ) : (
                <p className="text-xl font-bold text-ink">{activeRequestCount}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="px-6 py-5">
          <CardContent className="flex items-center gap-3 p-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-(--offered-tint) text-(--offered-text)">
              <Search className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted">Skills to Explore</p>
              {loadingCatalog ? (
                <Skeleton className="mt-1 h-6 w-8" />
              ) : (
                <p className="text-xl font-bold text-ink">{availableCount}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Tabs defaultValue="skills">
          <TabsList className="bg-secondary">
            <TabsTrigger value="skills" className={ACTIVE_TAB_CLASSES}>
              <Wrench className="size-3.5" />
              My Skills
            </TabsTrigger>
            <TabsTrigger value="requests" className={ACTIVE_TAB_CLASSES}>
              <ClipboardList className="size-3.5" />
              Requests
              {requests.length > 0 && <CountPill count={requests.length} />}
            </TabsTrigger>
            <TabsTrigger value="browse" className={ACTIVE_TAB_CLASSES}>
              <Search className="size-3.5" />
              Browse
            </TabsTrigger>
          </TabsList>

          <TabsContent value="skills" className="mt-4">
            <MySkillsTab requests={requests} />
          </TabsContent>

          <TabsContent value="requests" className="mt-4">
            <RequestsTab requests={requests} loading={loadingRequests} onNewRequest={openNewRequest} />
          </TabsContent>

          <TabsContent value="browse" className="mt-4">
            <BrowseSkillsTab
              catalog={catalog}
              loading={loadingCatalog}
              requests={requests}
              onApply={openApplyRequest}
            />
          </TabsContent>
        </Tabs>
      </div>

      <SkillRequestDialog
        key={dialogKey}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        isApplyMode={!!dialogSkill}
        initialSkillName={dialogSkill?.name}
        initialCategory={dialogSkill?.category}
        initialSkillId={dialogSkill?.skillId}
        initialSkillDocId={dialogSkill?.skillDocId}
        onSubmitted={() => setRequestsVersion((v) => v + 1)}
      />
    </JoshDiv>
  );
}
