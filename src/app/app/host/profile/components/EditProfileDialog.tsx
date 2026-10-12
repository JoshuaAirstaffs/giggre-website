"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useAppSelector } from "@/store/hooks";
import { useUpdateProfile } from "@/store/useUpdateProfile";
import { CONTENT_REJECTION_MESSAGE, containsBlockedContent } from "@/lib/content-filter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const BIO_MAX_LENGTH = 300;

// Host counterpart to worker/profile/components/EditProfileDialog.tsx — same
// shape, plus the "Business Name" field gig_host_profile_screen.dart's own
// edit sheet has (_showEditPersonalInfo's companyCtrl) that the worker side
// has no equivalent of. Kept as its own component rather than a shared one
// with a conditional field, since the two also save/style differently
// (host-tinted here vs worker-tinted there).
export default function EditProfileDialog({ children }: { children: ReactNode }) {
  const { authUser, profile } = useAppSelector((root) => root.user);
  const updateProfile = useUpdateProfile();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(profile?.name ?? "");
  const [company, setCompany] = useState(profile?.company ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | undefined>(profile?.photoUrl);
  const [saving, setSaving] = useState(false);

  const initials = (name || "?").slice(0, 2).toUpperCase();

  function handleOpenChange(next: boolean) {
    if (next) {
      // Reset the form to the latest profile values each time it opens.
      setName(profile?.name ?? "");
      setCompany(profile?.company ?? "");
      setPhone(profile?.phone ?? "");
      setBio(profile?.bio ?? "");
      setPhotoFile(null);
      setPhotoPreview(profile?.photoUrl);
    }
    setOpen(next);
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSave() {
    if (!authUser?.uid || saving) return;
    // Mirrors gig_host_profile_screen.dart's own edit-save check (name + bio
    // against ContentFilterService) before this round-trips to Firestore.
    if (await containsBlockedContent(name, bio)) {
      toast.error(CONTENT_REJECTION_MESSAGE);
      return;
    }
    setSaving(true);
    try {
      let photoUrl = profile?.photoUrl;
      if (photoFile) {
        const storageRef = ref(storage, `users/${authUser.uid}/profile/avatar`);
        await uploadBytes(storageRef, photoFile);
        photoUrl = await getDownloadURL(storageRef);
      }

      await updateProfile({
        name: name.trim(),
        company: company.trim(),
        phone: phone.trim(),
        bio: bio.trim(),
        ...(photoUrl ? { photoUrl } : {}),
      });

      toast.success("Profile updated");
      setOpen(false);
    } catch (err) {
      console.error("Failed to update profile:", err);
      toast.error("Couldn't update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Update your photo, name, business name, phone number, and about section.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            <AvatarImage src={photoPreview} alt={name} />
            <AvatarFallback className="bg-host-tint text-lg font-semibold text-(--host-text)">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <Label htmlFor="edit-host-profile-photo" className="sr-only">
              Profile photo
            </Label>
            <Input id="edit-host-profile-photo" type="file" accept="image/*" onChange={handlePhotoChange} className="max-w-56" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-host-profile-name">Name</Label>
          <Input id="edit-host-profile-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-host-profile-company">Business name (optional)</Label>
          <Input
            id="edit-host-profile-company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Your business or company name"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-host-profile-phone">Phone number</Label>
          <Input id="edit-host-profile-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+639171234567" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-host-profile-email">Email</Label>
          <Input id="edit-host-profile-email" value={profile?.email ?? ""} disabled readOnly />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="edit-host-profile-bio">About</Label>
            <span className="text-xs text-muted">
              {bio.length}/{BIO_MAX_LENGTH}
            </span>
          </div>
          <Textarea
            id="edit-host-profile-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX_LENGTH))}
            placeholder="Tell workers a bit about yourself or your business…"
            rows={4}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-host text-on-host hover:bg-(--host-end)">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
