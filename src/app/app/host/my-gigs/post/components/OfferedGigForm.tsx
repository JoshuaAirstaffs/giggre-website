"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  EXPERIENCE_LEVEL_OPTIONS,
  fetchFavoriteWorkers,
  findWorkerByUserId,
  postOfferedGig,
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
}

export default function OfferedGigForm({ preselectedWorker }: OfferedGigFormProps) {
  const { authUser, profile } = useAppSelector((root) => root.user);
  const { fields, setField, setLocation, locating, captureLocation, reset, validateCommon, checkContent, getScheduledDate, currencyCode } = useCommonGigFields();
  const [skills, setSkills] = useState<string[]>([]);
  const [skillRequired, setSkillRequired] = useState("");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>("entry");
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
    fetchSkillNames()
      .then(setSkills)
      .catch((err) => console.error("Failed to load skills:", err));
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
    if (selectedWorkers.length === 0) {
      return toast.error("Please select at least one worker to offer this gig to.");
    }
    const contentError = await checkContent();
    if (contentError) return toast.error(contentError);

    setSubmitting(true);
    try {
      const gigId = await postOfferedGig({
        hostId: authUser.uid,
        hostName: profile?.name ?? "",
        title: fields.title.trim(),
        description: fields.description.trim(),
        budget: Number(fields.budget),
        currencyCode,
        location: fields.location!,
        address: fields.address.trim(),
        scheduledDate: getScheduledDate(),
        skillRequired,
        experienceLevel,
        workers: selectedWorkers,
      });
      toast.success("Gig Successfully Posted");
      setLastGigId(gigId);
      reset();
      setSkillRequired("");
      setExperienceLevel("entry");
      setSelectedWorkers([]);
    } catch (err) {
      console.error("Failed to post offered gig:", err);
      toast.error("Couldn't post the gig. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

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
      <p className="text-sm text-muted">
        Offered gigs go directly to the worker(s) you choose — each one can accept or decline.
      </p>

      <div className="grid gap-x-8 gap-y-4 lg:grid-cols-2">
        <div className="space-y-4">
          <CommonGigDetails
            fields={fields}
            setField={setField}
            currencyCode={currencyCode}
            afterBudget={workerPicker}
            workerSlotsField={
              <div className="flex h-8 items-center rounded-lg border border-input bg-input/50 px-2.5 text-sm text-muted-foreground">
                {selectedWorkers.length}
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
        {submitting ? "Posting…" : "Offer Gig"}
      </Button>
      {lastGigId && (
        <p className="text-xs text-muted">
          Gig ID (offered_gigs): <code className="font-mono">{lastGigId}</code>
        </p>
      )}
    </div>
  );
}
