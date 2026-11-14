"use client";

import { useEffect, useMemo, useRef } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { MAX_GIG_IMAGES } from "@/lib/gig-images";

const MAX_MB = 15;

/** "Photos (optional)" for Post a gig: up to 5 images, uploaded on Post. */
export function GigPhotosInput({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  function add(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list).filter((f) => f.type.startsWith("image/"));
    const tooBig = picked.filter((f) => f.size > MAX_MB * 1024 * 1024);
    if (tooBig.length) toast.error(`Photos must be under ${MAX_MB} MB.`);
    const ok = picked.filter((f) => f.size <= MAX_MB * 1024 * 1024);
    const room = MAX_GIG_IMAGES - files.length;
    if (ok.length > room) toast.info(`Only ${MAX_GIG_IMAGES} photos per gig — added the first ${room}.`);
    onChange([...files, ...ok.slice(0, room)]);
  }

  return (
    <div className="space-y-1.5">
      <Label>Photos (optional)</Label>
      <p className="text-xs text-muted">Up to {MAX_GIG_IMAGES} — the place, the item or the task. Workers see them in the gig details.</p>
      <div className="flex flex-wrap gap-2 pt-1">
        {previews.map((src, i) => (
          <div key={src} className="relative size-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Photo ${i + 1}`} className="size-20 rounded-lg object-cover" />
            <button
              type="button"
              aria-label={`Remove photo ${i + 1}`}
              onClick={() => onChange(files.filter((_, j) => j !== i))}
              className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full border-2 border-white bg-black/80 text-white"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {files.length < MAX_GIG_IMAGES && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex size-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-hairline text-muted hover:border-(--host-start) hover:text-ink"
          >
            <ImagePlus className="size-5" />
            <span className="text-xs">{files.length}/{MAX_GIG_IMAGES}</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** Photos on a posted gig — thumbnails; click opens the full image. */
export function GigPhotos({ urls, size = "md" }: { urls: string[]; size?: "sm" | "md" }) {
  if (!urls.length) return null;
  const cls = size === "sm" ? "h-16 w-20" : "h-24 w-32";
  return (
    <div className="flex flex-wrap gap-2">
      {urls.map((u, i) => (
        <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={u} alt={`Gig photo ${i + 1}`} className={`${cls} object-cover transition-opacity hover:opacity-85`} loading="lazy" />
        </a>
      ))}
    </div>
  );
}
