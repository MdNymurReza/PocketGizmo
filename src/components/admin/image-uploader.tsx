"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const MAX_MB = 5;

export function ImageUploader({ images, onChange }: { images: string[]; onChange: (images: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const supabase = createClient();
    const list = Array.from(files).slice(0, 10 - images.length);
    setUploading(list.length);
    const urls: string[] = [];
    for (const file of list) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image`);
      } else if (file.size > MAX_MB * 1024 * 1024) {
        toast.error(`${file.name} is larger than ${MAX_MB}MB`);
      } else {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `products/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("product-images").upload(path, file, { cacheControl: "31536000" });
        if (error) toast.error(`Upload failed: ${error.message}`);
        else urls.push(supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl);
      }
      setUploading((n) => n - 1);
    }
    if (urls.length) onChange([...images, ...urls]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const move = (i: number, dir: -1 | 1) => {
    const next = [...images];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    onChange(next);
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {images.map((src, i) => (
          <div key={src} className={cn("group relative aspect-square overflow-hidden rounded-lg border border-line bg-surface", i === 0 && "ring-2 ring-accent")}>
            <Image src={src} alt={`Product photo ${i + 1}`} fill sizes="160px" className="object-cover" />
            {i === 0 && <span className="absolute top-1 left-1 rounded-full bg-white px-2 text-xs font-medium shadow-xs">Cover</span>}
            <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="grid size-7 place-items-center rounded-lg bg-white/90 disabled:opacity-30" aria-label="Move left">
                <ChevronLeft className="size-4" />
              </button>
              <button type="button" onClick={() => onChange(images.filter((_, j) => j !== i))} className="grid size-7 place-items-center rounded-lg bg-white/90 text-danger" aria-label="Remove photo">
                <X className="size-4" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1} className="grid size-7 place-items-center rounded-lg bg-white/90 disabled:opacity-30" aria-label="Move right">
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        ))}
        {images.length < 10 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading > 0}
            className="grid aspect-square place-items-center rounded-lg border border-dashed border-line text-ink-soft hover:border-ink/30 hover:text-ink"
          >
            <span className="flex flex-col items-center gap-1 text-sm font-medium">
              {uploading > 0 ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
              {uploading > 0 ? `Uploading ${uploading}…` : "Add photos"}
            </span>
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
      <p className="mt-2 text-xs text-ink-soft">Up to 10 photos, {MAX_MB}MB each. The first photo is the cover.</p>
    </div>
  );
}
