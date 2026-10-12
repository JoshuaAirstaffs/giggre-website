"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useAppSelector } from "@/store/hooks";
import { useUpdateProfile } from "@/store/useUpdateProfile";
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

export default function EditProfileDialog({ children }: { children: ReactNode }) {
  const { authUser, profile } = useAppSelector((root) => root.user);
  const updateProfile = useUpdateProfile();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(profile?.name ?? "");
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
          <DialogDescription>Update your photo, name, phone number, and about section.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            <AvatarImage src={photoPreview} alt={name} />
            <AvatarFallback className="bg-worker-tint text-lg font-semibold text-(--worker-text)">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <Label htmlFor="edit-profile-photo" className="sr-only">
              Profile photo
            </Label>
            <Input id="edit-profile-photo" type="file" accept="image/*" onChange={handlePhotoChange} className="max-w-56" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-profile-name">Name</Label>
          <Input id="edit-profile-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-profile-phone">Phone number</Label>
          <Input id="edit-profile-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+639171234567" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-profile-email">Email</Label>
          <Input id="edit-profile-email" value={profile?.email ?? ""} disabled readOnly />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="edit-profile-bio">About</Label>
            <span className="text-xs text-muted">
              {bio.length}/{BIO_MAX_LENGTH}
            </span>
          </div>
          <Textarea
            id="edit-profile-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX_LENGTH))}
            placeholder="Tell hosts a bit about yourself…"
            rows={4}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-worker text-white hover:bg-(--worker-end)">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
