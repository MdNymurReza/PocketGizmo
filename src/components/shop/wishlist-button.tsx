"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { toggleWishlist } from "@/app/(shop)/product/[slug]/actions";
import { cn } from "@/lib/utils";

/** Saves a product to the customer's list, or removes it. Visitors are sent to log in first. */
export function WishlistButton({ productId, slug, initialSaved }: { productId: string; slug: string; initialSaved: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(initialSaved);

  const toggle = () =>
    start(async () => {
      const res = await toggleWishlist(productId);
      if (res.login) return void router.push(`/login?next=/product/${slug}`);
      if (res.error) return void toast.error(res.error);
      setSaved(Boolean(res.saved));
      toast.success(res.saved ? "Saved to your list" : "Removed from your list");
    });

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors disabled:opacity-60",
        saved ? "border-accent/30 bg-accent/5 text-accent" : "border-line bg-white text-ink-soft hover:text-ink",
      )}
    >
      <Heart className={cn("size-4", saved && "fill-accent")} />
      {saved ? "Saved" : "Save"}
    </button>
  );
}
