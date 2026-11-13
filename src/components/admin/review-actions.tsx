"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteReview, setReviewStatus } from "@/app/admin/reviews/actions";
import { Button } from "@/components/ui";

export function ReviewActions({ id, status }: { id: string; status: "pending" | "approved" | "rejected" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const run = (fn: () => Promise<{ error?: string }>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (res.error) return void toast.error(res.error);
      toast.success(ok);
      setConfirming(false);
      router.refresh();
    });

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-soft">Delete for good?</span>
        <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => deleteReview(id), "Review deleted")}>
          Delete
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
          Keep
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "approved" && (
        <Button size="sm" disabled={pending} onClick={() => run(() => setReviewStatus(id, "approved"), "Review published")}>
          <Check className="size-4" /> Approve
        </Button>
      )}
      {status !== "rejected" && (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setReviewStatus(id, "rejected"), status === "approved" ? "Review hidden" : "Review rejected")}>
          <X className="size-4" /> {status === "approved" ? "Hide" : "Reject"}
        </Button>
      )}
      <Button size="sm" variant="ghost" className="text-ink-soft hover:text-danger" onClick={() => setConfirming(true)} aria-label="Delete review">
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
