"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { deleteMyReview, submitReview } from "@/app/(shop)/product/[slug]/actions";
import { Badge, Button, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";

const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];
const MAX = 1500;

type Mine = { rating: number; comment: string; status: "pending" | "approved" | "rejected" } | null;

export function ReviewForm({ productId, slug, mine }: { productId: string; slug: string; mine: Mine }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(!mine);
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(mine?.comment ?? "");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) return setError("Choose a star rating first.");
    start(async () => {
      const res = await submitReview({ productId, slug, rating, comment });
      if (res.error) {
        setError(res.error);
        return void toast.error(res.error);
      }
      toast.success("Thanks! Your review will appear once we've approved it.");
      setEditing(false);
      router.refresh();
    });
  };

  const remove = () =>
    start(async () => {
      const res = await deleteMyReview(productId, slug);
      if (res.error) return void toast.error(res.error);
      toast.success("Review deleted");
      setRating(0);
      setComment("");
      setConfirming(false);
      setEditing(true);
      router.refresh();
    });

  // Already reviewed: show the review and its status.
  if (mine && !editing) {
    return (
      <div className="rounded-xl border border-line p-5 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">Your review</p>
          <Badge color={mine.status === "approved" ? "success" : mine.status === "pending" ? "warning" : "neutral"}>
            {mine.status === "approved" ? "Published" : mine.status === "pending" ? "Waiting for approval" : "Not published"}
          </Badge>
        </div>
        <p className="mt-2 flex gap-0.5" role="img" aria-label={`${mine.rating} out of 5 stars`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} className={cn("size-4", n <= mine.rating ? "fill-amber-400" : "fill-surface-2")} strokeWidth={0} />
          ))}
        </p>
        {mine.comment && <p className="mt-2 whitespace-pre-line text-ink-soft">{mine.comment}</p>}
        {mine.status === "rejected" && (
          <p className="mt-2 text-xs text-ink-soft">This review wasn&apos;t published. You can edit it and send it again.</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {confirming ? (
            <>
              <span className="text-ink-soft">Delete your review?</span>
              <Button size="sm" variant="danger" disabled={pending} onClick={remove}>
                Delete
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
                Keep
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                Edit review
              </Button>
              <Button size="sm" variant="ghost" className="text-ink-soft" onClick={() => setConfirming(true)}>
                Delete
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  const shown = hover || rating;
  return (
    <form onSubmit={submit} className="rounded-xl border border-line p-5">
      <p className="font-medium">{mine ? "Edit your review" : "Write a review"}</p>
      <p className="mt-1 text-sm text-ink-soft">You bought this, so tell others what you think.</p>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium">Your rating</legend>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="cursor-pointer p-0.5" onMouseEnter={() => setHover(n)}>
                <input
                  type="radio"
                  name="rating"
                  value={n}
                  checked={rating === n}
                  onChange={() => {
                    setRating(n);
                    setError("");
                  }}
                  className="peer sr-only"
                />
                <Star
                  className={cn(
                    "size-7 rounded-sm transition-transform peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent hover:scale-110",
                    n <= shown ? "fill-amber-400" : "fill-surface-2",
                  )}
                  strokeWidth={0}
                />
                <span className="sr-only">
                  {n} star{n > 1 ? "s" : ""}: {LABELS[n]}
                </span>
              </label>
            ))}
          </div>
          <span className="text-sm text-ink-soft" aria-hidden>
            {LABELS[shown]}
          </span>
        </div>
      </fieldset>

      <label className="mt-4 flex flex-col gap-1.5">
        <span className="text-sm font-medium">
          Your review <span className="font-normal text-ink-soft">(optional)</span>
        </span>
        <Textarea
          rows={4}
          value={comment}
          maxLength={MAX}
          onChange={(e) => setComment(e.target.value)}
          placeholder="How is the quality? Does it fit and work as you expected?"
        />
        <span className="text-right text-xs text-ink-soft tabular-nums">
          {comment.length} / {MAX}
        </span>
      </label>

      {error && (
        <p role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {mine ? "Save review" : "Submit review"}
        </Button>
        {mine && (
          <Button type="button" variant="ghost" disabled={pending} onClick={() => setEditing(false)}>
            Cancel
          </Button>
        )}
        <span className="text-xs text-ink-soft">Reviews appear after we approve them.</span>
      </div>
    </form>
  );
}
