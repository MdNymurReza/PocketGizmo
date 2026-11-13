"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export const REVIEW_PHOTOS_MAX = 3;

/** Phone photos are large, so they are made smaller in the browser before they are uploaded. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read the photo"))), "image/jpeg", 0.85));
}

/** Lets a customer add up to 3 photos to a review. Photos are uploaded as soon as they are chosen. */
export function ReviewPhotos({ userId, photos, onChange, disabled }: { userId: string; photos: string[]; onChange: (photos: string[]) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const supabase = createClient();
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files).slice(0, REVIEW_PHOTOS_MAX - photos.length)) {
      try {
        if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not a photo`);
        const blob = await shrink(file);
        const path = `${userId}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from("review-photos").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
        if (error) throw new Error("Upload failed. Please try again.");
        urls.push(supabase.storage.from("review-photos").getPublicUrl(path).data.publicUrl);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not add that photo");
      }
    }
    if (urls.length) onChange([...photos, ...urls]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="mt-4">
      <p className="text-sm font-medium">
        Photos <span className="font-normal text-ink-soft">(optional, up to {REVIEW_PHOTOS_MAX})</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {photos.map((src, i) => (
          <div key={src} className="relative size-20 overflow-hidden rounded-lg border border-line bg-surface">
            <Image src={src} alt={`Your photo ${i + 1}`} fill sizes="80px" className="object-cover" />
            <button
              type="button"
              onClick={() => onChange(photos.filter((p) => p !== src))}
              disabled={disabled}
              className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-white/90 text-ink shadow-xs hover:text-danger"
              aria-label={`Remove photo ${i + 1}`}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {photos.length < REVIEW_PHOTOS_MAX && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading}
            className="grid size-20 place-items-center rounded-lg border border-dashed border-line text-xs font-medium text-ink-soft hover:border-ink/30 hover:text-ink disabled:opacity-60"
          >
            <span className="flex flex-col items-center gap-1">
              {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
              {uploading ? "Uploading" : "Add photo"}
            </span>
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => upload(e.target.files)} />
    </div>
  );
}

/** Small photo thumbnails under a review. A click opens the full photo. */
export function ReviewPhotoList({ photos, author }: { photos: string[]; author: string }) {
  if (!photos.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {photos.map((src, i) => (
        <li key={src}>
          <a href={src} target="_blank" rel="noopener noreferrer" className="relative block size-20 overflow-hidden rounded-lg border border-line bg-surface">
            <Image src={src} alt={`Photo ${i + 1} from ${author}`} fill sizes="80px" className="object-cover transition-transform hover:scale-105" />
          </a>
        </li>
      ))}
    </ul>
  );
}
