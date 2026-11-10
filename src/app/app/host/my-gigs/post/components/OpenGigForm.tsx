"use client";

import { useUnverifiedLimitGuard } from "@/components/UnverifiedLimit";
import { TaskTypeSelect } from "./TaskTypeSelect";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { EXPERIENCE_LEVEL_OPTIONS, postOpenGig, type ExperienceLevel } from "@/lib/post-gig";
import { useCommonGigFields } from "./useCommonGigFields";
import { CommonGigDetails, CommonGigSchedule } from "./CommonGigFields";

export default function OpenGigForm() {
  const { authUser, profile } = useAppSelector((root) => root.user);
  const {
    fields,
    setField,
    setLocation,
    locating,
    captureLocation,
    reset,
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
  const [requiredSkill, setRequiredSkill] = useState("");
  // GSIN task type — shown once the admin has set up task types, then required.
  const [taskTypeId, setTaskTypeId] = useState("");
  const [hasTaskTypes, setHasTaskTypes] = useState(false);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>("entry");
  const [submitting, setSubmitting] = useState(false);
  const [lastGigId, setLastGigId] = useState<string | null>(null);

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

  // "Post Again" from a past gig's detail page (see post-again.ts) — seeds
  // everything except schedule/location, which stay blank for the host to
  // set fresh. Runs once on mount; harmless no-op on a dev StrictMode
  // double-invoke since the prefill is already cleared after the first run.
  useEffect(() => {
    const prefill = consumePostAgainPrefill("open");
    if (!prefill) return;
    setField("title", prefill.title);
    setField("description", prefill.description);
    setField("payType", prefill.payType);
    setField("budget", String(prefill.amount));
    setField("workDurationHours", prefill.workDurationHours != null ? String(prefill.workDurationHours) : "");
    setField("workerSlots", String(prefill.workerSlots));
    // Seeding one-shot prefill state on mount, not reacting to anything —
    // same justification as useCommonGigFields' own reset-before-resubscribe
    // effects elsewhere in this codebase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (prefill.requiredSkill) setRequiredSkill(prefill.requiredSkill);
    if (prefill.experienceLevel) setExperienceLevel(prefill.experienceLevel);
    toast.info(`Prefilled from "${prefill.title}" — pick a new date and time.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit() {
    if (!authUser?.uid) return;
    const error = validateCommon();
    if (error) return toast.error(error);
    if (!requiredSkill) return toast.error("Please select a required skill.");
    if (hasTaskTypes && !taskTypeId) return toast.error("Pick the type of task.");
    const contentError = await checkContent();
    if (contentError) return toast.error(contentError);

    if (!(await limitGuard({ amount: resolvePayFields().budget * Math.max(1, Number(fields.workerSlots) || 1), currencyCode, action: "post" }))) return;
    setSubmitting(true);
    try {
      const gigId = await postOpenGig({
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
        workerSlots: Number(fields.workerSlots),
        requiredSkill,
        experienceLevel,
        taskTypeId: taskTypeId || undefined,
      });
      toast.success("Gig Successfully Posted");
      setLastGigId(gigId);
      reset();
      setRequiredSkill("");
      setTaskTypeId("");
      setExperienceLevel("entry");
    } catch (err) {
      console.error("Failed to post open gig:", err);
      toast.error("Couldn't post the gig. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {limitDialog}
      <p className="text-sm text-muted">
        Open gigs are visible to every nearby worker with the right skill — you choose who to accept from the applicants.
      </p>
      <div className="grid gap-x-8 gap-y-4 lg:grid-cols-2">
        <div className="space-y-4">
          <CommonGigDetails fields={fields} setField={setField} currencyCode={currencyCode} />

          <div className="space-y-1.5">
            <Label>
              Required skill <span className="text-destructive">*</span>
            </Label>
            <Select value={requiredSkill} onValueChange={(v) => setRequiredSkill(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a skill">{requiredSkill || "Select a skill"}</SelectValue>
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

          <TaskTypeSelect value={taskTypeId} onChange={setTaskTypeId} skill={requiredSkill} onAvailable={setHasTaskTypes} />

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
                      ? "flex-1 rounded-lg border border-worker bg-worker-tint py-2 text-center text-xs font-bold text-(--worker-text)"
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

      <Button onClick={handleSubmit} disabled={submitting} className="w-full p-6 bg-worker text-white hover:bg-(--worker-end)">
        {submitting ? "Posting…" : "Post Open Gig"}
      </Button>
      {lastGigId && (
        <p className="text-xs text-muted">
          Gig ID (open_gigs): <code className="font-mono">{lastGigId}</code>
        </p>
      )}
    </div>
  );
}
