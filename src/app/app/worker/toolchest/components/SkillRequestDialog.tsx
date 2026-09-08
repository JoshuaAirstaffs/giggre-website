"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Paperclip, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppSelector } from "@/store/hooks";
import {
  EXPERIENCE_LEVELS,
  SKILL_CATEGORIES,
  levelFromYears,
  submitSkillRequest,
} from "@/lib/toolchest";

interface SkillRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isApplyMode?: boolean;
  initialSkillName?: string;
  initialCategory?: string;
  initialSkillId?: string;
  initialSkillDocId?: string;
  onSubmitted?: () => void;
}

const emptyForm = {
  skillName: "",
  category: "",
  reason: "",
  years: "",
  months: "",
  relatedExperience: "",
  suggestedRequirement: "",
  contactAvailability: "",
};

export default function SkillRequestDialog({
  open,
  onOpenChange,
  isApplyMode = false,
  initialSkillName,
  initialCategory,
  initialSkillId,
  initialSkillDocId,
  onSubmitted,
}: SkillRequestDialogProps) {
  const { authUser, profile } = useAppSelector((root) => root.user);
  // The parent remounts this component (via a changing `key`) every time it
  // opens, so a lazy initializer reading the current props is enough to
  // reset the form — no effect needed to "sync" state to props.
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    skillName: initialSkillName ?? "",
    category: SKILL_CATEGORIES.includes(initialCategory as (typeof SKILL_CATEGORIES)[number])
      ? (initialCategory as string)
      : "",
  }));
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const level = levelFromYears(form.years.trim() === "" ? null : Number(form.years));

  function handleFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    setProofFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      return [...prev, ...picked.filter((f) => !existingNames.has(f.name))];
    });
    e.target.value = "";
  }

  function removeFile(index: number) {
    setProofFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!authUser?.uid) return;
    if (!form.skillName.trim()) return toast.error("Please enter a skill name.");
    if (!form.category) return toast.error("Please select a skill category.");
    if (!isApplyMode && !form.reason.trim()) return toast.error("Please explain why you want this skill added.");
    if (!form.years.trim()) return toast.error("Please enter years of experience.");
    const months = Number(form.months.trim());
    if (form.months.trim() === "" || Number.isNaN(months) || months < 0 || months > 11) {
      return toast.error("Months of experience must be between 0 and 11.");
    }
    if (!level) return toast.error("Please enter a valid number of years.");

    setSubmitting(true);
    try {
      await submitSkillRequest({
        uid: authUser.uid,
        gigWorkerId: profile?.userId ?? authUser.uid,
        userName: profile?.name ?? "",
        userEmail: profile?.email ?? "",
        skillId: initialSkillId ?? "",
        skillDocId: initialSkillDocId ?? "",
        skillName: form.skillName.trim(),
        skillCategory: form.category,
        reason: form.reason.trim(),
        experienceLevel: level,
        years: form.years.trim(),
        months: form.months.trim(),
        proofFiles,
        relatedExperience: form.relatedExperience.trim(),
        suggestedRequirement: form.suggestedRequirement.trim(),
        contactAvailability: form.contactAvailability.trim(),
      });
      toast.success("Skill request submitted!");
      onOpenChange(false);
      onSubmitted?.();
    } catch (err) {
      console.error("Failed to submit skill request:", err);
      toast.error("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isApplyMode ? "Apply for a Skill" : "Request a Skill"}</DialogTitle>
          <DialogDescription>
            Submit your experience for admin review. You can track the status in Requests.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="skill-name">
              Skill Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="skill-name"
              value={form.skillName}
              onChange={(e) => setForm((f) => ({ ...f, skillName: e.target.value }))}
              placeholder="e.g. Plumbing, Graphic Design, Bartending"
              disabled={isApplyMode}
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              Skill Category <span className="text-destructive">*</span>
            </Label>
            <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v ?? "" }))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a category">{form.category || "Select a category"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SKILL_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isApplyMode && (
            <div className="space-y-1.5">
              <Label htmlFor="skill-reason">
                Why do you want this skill added? <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="skill-reason"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Short explanation..."
                rows={3}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>
              Years / Months of Experience <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-3">
              <Input
                type="number"
                min={0}
                value={form.years}
                onChange={(e) => setForm((f) => ({ ...f, years: e.target.value }))}
                placeholder="Years"
              />
              <Input
                type="number"
                min={0}
                max={11}
                value={form.months}
                onChange={(e) => setForm((f) => ({ ...f, months: e.target.value }))}
                placeholder="Months"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Experience Level</Label>
            <p className="text-xs text-muted">Automatically determined from your years of experience.</p>
            <div className="flex gap-2">
              {EXPERIENCE_LEVELS.map((lvl) => (
                <span
                  key={lvl}
                  className={
                    lvl === level
                      ? "flex-1 rounded-lg border border-worker bg-worker-tint py-2 text-center text-xs font-bold text-(--worker-text)"
                      : "flex-1 rounded-lg border border-hairline py-2 text-center text-xs text-muted"
                  }
                >
                  {lvl}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="skill-proof">Proof or Supporting Documents</Label>
            {proofFiles.length > 0 && (
              <div className="space-y-1.5">
                {proofFiles.map((file, i) => (
                  <div
                    key={`${file.name}-${i}`}
                    className="flex items-center gap-2 rounded-lg border border-dashed border-hairline bg-worker-tint px-3 py-1.5 text-xs text-(--worker-text)"
                  >
                    <Paperclip className="size-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <button type="button" onClick={() => removeFile(i)} aria-label="Remove file">
                      <X className="size-3.5 text-muted" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Input id="skill-proof" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={handleFilesPicked} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="skill-related">Related Work Experience</Label>
            <Textarea
              id="skill-related"
              value={form.relatedExperience}
              onChange={(e) => setForm((f) => ({ ...f, relatedExperience: e.target.value }))}
              placeholder="Where have you used this skill before?"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="skill-suggested">Suggested Requirement</Label>
            <Textarea
              id="skill-suggested"
              value={form.suggestedRequirement}
              onChange={(e) => setForm((f) => ({ ...f, suggestedRequirement: e.target.value }))}
              placeholder='e.g. "Must upload TESDA certificate"'
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="skill-contact">Contact / Availability for Verification</Label>
            <Textarea
              id="skill-contact"
              value={form.contactAvailability}
              onChange={(e) => setForm((f) => ({ ...f, contactAvailability: e.target.value }))}
              placeholder="e.g. 09XX-XXX-XXXX, weekdays 9am–5pm"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-worker text-white hover:bg-(--worker-end)">
            {submitting ? "Submitting…" : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
