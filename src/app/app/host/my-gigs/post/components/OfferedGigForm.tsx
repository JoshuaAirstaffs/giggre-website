"use client";

import { useUnverifiedLimitGuard } from "@/components/UnverifiedLimit";
import { TaskTypeSelect } from "./TaskTypeSelect";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Star, Users, UserSearch, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppSelector } from "@/store/hooks";
import { fetchSkillNames } from "@/lib/browse-gigs";
import { consumePostAgainPrefill } from "@/lib/post-again";
import {
  EXPERIENCE_LEVEL_OPTIONS,
  fetchFavoriteWorkers,
  findWorkerByUserId,
  postOfferedGig,
  updateOfferedGig,
  type EditGigData,
  type ExperienceLevel,
  type WorkerLookupResult,
} from "@/lib/post-gig";
import { useCommonGigFields } from "./useCommonGigFields";
import { CommonGigDetails, CommonGigSchedule } from "./CommonGigFields";

const USER_ID_FORMAT = /^[A-Z]{3}\d{6}$/i;

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

interface OfferedGigFormProps {
  preselectedWorker?: WorkerLookupResult | null;
  editGig?: EditGigData | null;
}

export default function OfferedGigForm({ preselectedWorker, editGig }: OfferedGigFormProps) {
  const router = useRouter();
  const { authUser, profile } = useAppSelector((root) => root.user);
  const {
    fields,
    setField,
    setLocation,
    locating,
    captureLocation,
    reset,
    seedFields,
    validateCommon,
    checkContent,
    getScheduledDate,
    resolvePayFields,
    resolveWorkDuration,
    currencyCode,
  } = useCommonGigFields();
  // Unverified earning limit (same check as the app before posting).
  const { guard: limitGuard, dialog: limitDialog } = useUnverifiedLimitGuard();
  const [skills, setSkills] = useState<string[]>([]);
  const [skillRequired, setSkillRequired] = useState(editGig?.skillRequired ?? "");
  // GSIN task type — shown once the admin has set up task types, then required.
  const [taskTypeId, setTaskTypeId] = useState(editGig?.taskTypeId ?? "");
  const [hasTaskTypes, setHasTaskTypes] = useState(false);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(editGig?.experienceLevel ?? "entry");
  // Arriving via the Favorites page's "Quick Offer" button — the parent page
  // keys this component by the resolved worker's uid (see post/page.tsx), so
  // by the time this instance mounts with a non-null preselectedWorker,
  // seeding it here directly is enough; no need to sync it in via an effect.
  const [selectedWorkers, setSelectedWorkers] = useState<WorkerLookupResult[]>(() =>
    preselectedWorker ? [preselectedWorker] : []
  );
  const [submitting, setSubmitting] = useState(false);
  const [lastGigId, setLastGigId] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [favorites, setFavorites] = useState<WorkerLookupResult[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  const [pickerQuery, setPickerQuery] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  useEffect(() => {
    // Firestore's `skills` collection requires an authenticated read
    // (isAuth() in the rules) — without this gate, the request can fire
    // before the client's auth token is attached yet, right after a fresh
    // page load, and fail with "Missing or insufficient permissions."
    if (!authUser?.uid) return;
    fetchSkillNames()
      .then(setSkills)
      .catch((err) => console.error("Failed to load skills:", err));
  }, [authUser?.uid]);

  // Seeds every field from the gig being edited — the parent page keys this
  // component by editGig?.gigId (same remount-on-resolve pattern already
  // used for preselectedWorker above), so this instance only ever mounts
  // once editGig has its final value. Recipients are deliberately left
  // alone (see the read-only recipient summary below) — editing never
  // changes who it's offered to.
  useEffect(() => {
    if (!editGig) return;
    seedFields(editGig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Post Again" from a past gig's detail page (see post-again.ts) — seeds
  // everything except schedule/location and the picked workers (the whole
  // point is letting the host re-pick who does the job this time). Runs
  // once on mount; harmless no-op on a dev StrictMode double-invoke since
  // the prefill is already cleared after the first run. workerSlots isn't
  // applied here — this form derives its slot count from selectedWorkers,
  // not a typed field.
  useEffect(() => {
    if (editGig) return;
    const prefill = consumePostAgainPrefill("offered");
    if (!prefill) return;
    setField("title", prefill.title);
    setField("description", prefill.description);
    setField("payType", prefill.payType);
    setField("budget", String(prefill.amount));
    setField("workDurationHours", prefill.workDurationHours != null ? String(prefill.workDurationHours) : "");
    // Seeding one-shot prefill state on mount, not reacting to anything —
    // same justification as useCommonGigFields' own reset-before-resubscribe
    // effects elsewhere in this codebase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (prefill.skillRequired) setSkillRequired(prefill.skillRequired);
    if (prefill.experienceLevel) setExperienceLevel(prefill.experienceLevel);
    toast.info(`Prefilled from "${prefill.title}" — pick a new date, time, and worker(s).`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirrors _WorkerPickerSheet._loadFavorites in post_offered_gig_screen.dart
  // — the host picks from workers they've favorited elsewhere (mobile-only
  // for now, no way to favorite from web yet), falling back to an exact
  // Giggre-ID lookup when nothing matches.
  useEffect(() => {
    if (!authUser?.uid) return;
    fetchFavoriteWorkers(authUser.uid)
      .then(setFavorites)
      .catch((err) => console.error("Failed to load favorite workers:", err))
      .finally(() => setLoadingFavorites(false));
  }, [authUser?.uid]);

  const filteredFavorites = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return favorites;
    return favorites.filter(
      (w) => w.name.toLowerCase().includes(q) || w.email.toLowerCase().includes(q) || w.userId.toLowerCase().includes(q)
    );
  }, [favorites, pickerQuery]);

  // Toggles a worker in/out of the selection — the popover stays open so the
  // host can keep picking more (mirrors _WorkerPickerSheet._toggle).
  function toggleWorker(found: WorkerLookupResult) {
    setSelectedWorkers((prev) =>
      prev.some((w) => w.uid === found.uid) ? prev.filter((w) => w.uid !== found.uid) : [...prev, found]
    );
    setPickerQuery("");
  }

  function removeWorker(uid: string) {
    setSelectedWorkers((prev) => prev.filter((w) => w.uid !== uid));
  }

  async function handleLookupById() {
    const query = pickerQuery.trim();
    if (!query) return;
    setLookingUp(true);
    try {
      const found = await findWorkerByUserId(query);
      if (!found) {
        toast.error("No worker found with that Giggre ID.");
      } else {
        toggleWorker(found);
      }
    } catch (err) {
      console.error("Failed to look up worker:", err);
      toast.error("Couldn't look up that worker. Please try again.");
    } finally {
      setLookingUp(false);
    }
  }

  async function handleSubmit() {
    if (!authUser?.uid) return;
    const error = validateCommon();
    if (error) return toast.error(error);
    if (!skillRequired) return toast.error("Please select a required skill.");
    if (!editGig && hasTaskTypes && !taskTypeId) return toast.error("Pick the type of task.");
    if (!editGig && selectedWorkers.length === 0) {
      return toast.error("Please select at least one worker to offer this gig to.");
    }
    const contentError = await checkContent();
    if (contentError) return toast.error(contentError);

    const recipientCount = editGig ? editGig.workerSlots : selectedWorkers.length;
    if (!(await limitGuard({ amount: resolvePayFields().budget * Math.max(1, recipientCount), currencyCode, action: "post" }))) return;
    setSubmitting(true);
    try {
      const input = {
        hostId: authUser.uid,
        hostName: profile?.name ?? "",
        title: fields.title.trim(),
        description: fields.description.trim(),
        ...resolvePayFields(),
        workDurationHours: resolveWorkDuration(),
        currencyCode,
        location: fields.location!,
        address: fields.address.trim(),
        place: fields.place,
        scheduledDate: getScheduledDate(),
        skillRequired,
        experienceLevel,
        taskTypeId: taskTypeId || undefined,
      };
      if (editGig) {
        await updateOfferedGig(editGig.gigId, input);
        toast.success("Gig updated!");
        router.push(`/app/host/my-gigs/offered/${editGig.gigId}`);
        return;
      }
      const gigId = await postOfferedGig({ ...input, workers: selectedWorkers });
      toast.success("Gig Successfully Posted");
      setLastGigId(gigId);
      reset();
      setSkillRequired("");
      setTaskTypeId("");
      setExperienceLevel("entry");
      setSelectedWorkers([]);
    } catch (err) {
      console.error(editGig ? "Failed to update offered gig:" : "Failed to post offered gig:", err);
      toast.error(editGig ? "Couldn't save changes. Please try again." : "Couldn't post the gig. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Recipients can't be changed after posting (see canEditGig in
  // host-gigs.ts) — a plain read-only summary replaces the interactive
  // picker in edit mode.
  const recipientSummary = (
    <div className="space-y-1.5">
      <Label>Offered to</Label>
      <div className="rounded-lg border border-input bg-input/50 px-2.5 py-1.5 text-sm text-muted-foreground">
        {editGig?.recipientNames?.length ? editGig.recipientNames.join(", ") : "—"}
      </div>
      <p className="text-xs text-muted">Recipients can&apos;t be changed after posting.</p>
    </div>
  );

  const workerPicker = (
    <div className="space-y-1.5">
      <Label htmlFor="worker-picker">
        Worker&apos;s Giggre ID <span className="text-destructive">*</span>
      </Label>
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger
          id="worker-picker"
          render={<button type="button" />}
          className="flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm"
        >
          <Users className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">
            {selectedWorkers.length === 0
              ? "Select workers"
              : `${selectedWorkers.length} worker${selectedWorkers.length === 1 ? "" : "s"} selected`}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start">
          <div className="p-2">
            <Input
              autoFocus
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder="Search favorites or enter a Giggre ID"
            />
          </div>
          <div className="max-h-64 overflow-y-auto border-t border-border">
            {loadingFavorites ? (
              <p className="p-3 text-center text-xs text-muted">Loading favorites…</p>
            ) : filteredFavorites.length > 0 ? (
              filteredFavorites.map((fav) => {
                const isSelected = selectedWorkers.some((w) => w.uid === fav.uid);
                return (
                  <button
                    key={fav.uid}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleWorker(fav)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent ${
                      isSelected ? "bg-(--offered-tint)" : ""
                    }`}
                  >
                    <Avatar size="sm">
                      <AvatarImage src={fav.photoUrl || undefined} alt={fav.name} />
                      <AvatarFallback className="text-xs">{initials(fav.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{fav.name}</p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs text-muted">{fav.userId}</p>
                        {fav.ratingCount > 0 && (
                          <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted">
                            <Star className="size-3 shrink-0 fill-worker text-worker" />
                            {fav.ratingAsWorker.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check className="size-4 shrink-0 text-(--offered-text)" />}
                  </button>
                );
              })
            ) : (
              <p className="p-3 text-center text-xs text-muted">
                {favorites.length === 0 ? "No favorite workers yet." : "No favorites match."}
              </p>
            )}
            {filteredFavorites.length === 0 &&
              !loadingFavorites &&
              USER_ID_FORMAT.test(pickerQuery.trim()) && (
                <button
                  type="button"
                  onClick={handleLookupById}
                  disabled={lookingUp}
                  className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm text-(--offered-text) hover:bg-accent"
                >
                  <UserSearch className="size-3.5 shrink-0" />
                  {lookingUp ? "Looking up…" : `Look up "${pickerQuery.trim().toUpperCase()}"`}
                </button>
              )}
          </div>
          <div className="border-t border-border p-2">
            <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => setPickerOpen(false)}>
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {selectedWorkers.length > 0 && (
        <div className="space-y-1.5">
          {selectedWorkers.map((w) => (
            <div
              key={w.uid}
              className="flex items-center gap-2 rounded-lg border border-(--offered-tint) bg-(--offered-tint) px-3 py-2 text-sm text-(--offered-text)"
            >
              <Check className="size-4 shrink-0" />
              <span className="flex-1 truncate">
                {w.name} · {w.userId}
              </span>
              <button type="button" onClick={() => removeWorker(w.uid)} aria-label={`Remove ${w.name}`}>
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {limitDialog}
      <p className="text-sm text-muted">
        Offered gigs go directly to the worker(s) you choose — each one can accept or decline.
      </p>

      <div className="grid gap-x-8 gap-y-4 lg:grid-cols-2">
        <div className="space-y-4">
          <CommonGigDetails
            fields={fields}
            setField={setField}
            currencyCode={currencyCode}
            afterBudget={editGig ? recipientSummary : workerPicker}
            workerSlotsField={
              <div className="flex h-8 items-center rounded-lg border border-input bg-input/50 px-2.5 text-sm text-muted-foreground">
                {editGig?.workerSlots ?? selectedWorkers.length}
              </div>
            }
          />

          <div className="space-y-1.5">
            <Label>
              Required skill <span className="text-destructive">*</span>
            </Label>
            <Select value={skillRequired} onValueChange={(v) => setSkillRequired(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a skill">{skillRequired || "Select a skill"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {skills.map((skill) => (
                  <SelectItem key={skill} value={skill}>
                    {skill}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <TaskTypeSelect value={taskTypeId} onChange={setTaskTypeId} skill={skillRequired} onAvailable={setHasTaskTypes} disabled={!!editGig} />

          <div className="space-y-1.5">
            <Label>Experience level</Label>
            <div className="flex gap-2">
              {EXPERIENCE_LEVEL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setExperienceLevel(opt.value)}
                  className={
                    opt.value === experienceLevel
                      ? "flex-1 rounded-lg border border-(--offered-start) bg-(--offered-tint) py-2 text-center text-xs font-bold text-(--offered-text)"
                      : "flex-1 rounded-lg border border-hairline py-2 text-center text-xs text-muted"
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <CommonGigSchedule
          fields={fields}
          setField={setField}
          setLocation={setLocation}
          locating={locating}
          captureLocation={captureLocation}
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full p-6 bg-(--offered-start) text-white hover:bg-(--offered-end)"
      >
        {editGig ? (submitting ? "Saving…" : "Save Changes") : submitting ? "Posting…" : "Offer Gig"}
      </Button>
      {!editGig && lastGigId && (
        <p className="text-xs text-muted">
          Gig ID (offered_gigs): <code className="font-mono">{lastGigId}</code>
        </p>
      )}
    </div>
  );
}
