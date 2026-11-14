"use client";

import { Check, Undo2 } from "lucide-react";
import { deliverStallOrder, setStallStatus } from "@/app/admin/stall/actions";
import { Button } from "@/components/ui";
import type { StallStatus } from "@/lib/stall";
import { useAction } from "@/lib/use-action";
import { formatBDT } from "@/lib/utils";

/**
 * One-click "delivered" for a row in the stall order list, so an order does not have to be opened.
 * When money is still due, the main button also records it as paid in cash.
 */
export function StallRowActions({ id, status, due }: { id: string; status: StallStatus; due: number }) {
  const { pending, run } = useAction();
  if (status === "cancelled") return null;

  if (status === "delivered") {
    return (
      <div className="flex items-center justify-end gap-1">
        <span className="inline-flex items-center gap-1 text-sm font-medium text-success">
          <Check className="size-4" /> Delivered
        </span>
        <Button size="sm" variant="ghost" className="text-ink-soft" disabled={pending} title="Not delivered after all" onClick={() => run(() => setStallStatus(id, "ready"), "Marked as not delivered")}>
          <Undo2 className="size-4" /> Undo
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="accent" disabled={pending} onClick={() => run(() => deliverStallOrder(id, true), due > 0 ? `Delivered, ${formatBDT(due)} received` : "Marked as delivered")}>
        <Check className="size-4" /> {due > 0 ? `Delivered, got ${formatBDT(due)}` : "Delivered"}
      </Button>
      {due > 0 && (
        <button
          type="button"
          disabled={pending}
          className="text-xs text-ink-soft underline underline-offset-4 hover:text-ink disabled:opacity-50"
          onClick={() => run(() => deliverStallOrder(id, false), "Delivered, payment still open")}
        >
          Delivered, not paid yet
        </button>
      )}
    </div>
  );
}
