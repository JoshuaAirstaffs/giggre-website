import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase";

// Gig photos (Post a gig — Quick / Open / Offered): up to 5, same as the app
// (gig_images_picker.dart). Stored at gig_images/{uid}/… (storage.rules),
// the gig keeps their download URLs in `images`.

export const MAX_GIG_IMAGES = 5;
const MAX_SIDE = 1600;

/** Shrinks a photo to at most 1600 px on its longest side, as JPEG. */
async function shrink(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob ?? file;
  } catch {
    return file;
  }
}

/** Uploads the photos; throws if any fails (so a gig isn't posted half-done). */
export async function uploadGigImages(uid: string, files: File[]): Promise<string[]> {
  const stamp = Date.now();
  const urls: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const blob = await shrink(files[i]);
    const r = ref(storage, `gig_images/${uid}/${stamp}_${i}.jpg`);
    await uploadBytes(r, blob, { contentType: blob.type || "image/jpeg" });
    urls.push(await getDownloadURL(r));
  }
  return urls;
}
