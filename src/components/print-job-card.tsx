"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, PackageCheck, Play, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useAction } from "@/lib/use-action";
import { updateJob } from "@/app/supplier/actions";
import { deleteJob, payJobs, setJobUnpaid } from "@/app/admin/supplier/actions";
import { Badge, Button, Input } from "@/components/ui";
import { ProductImage } from "@/components/shop/product-image";
import { JOB_STATUS_COLOR, JOB_STATUS_LABEL, isDone, jobTotal, roundMoney, type PrintJob, type PrintJobStatus } from "@/lib/print-jobs";
import { formatBDT, formatDay } from "@/lib/utils";

/**
 * One print job. The supplier sets status and cost; the admin can also mark it received, paid, or delete it.
 * The list gives each card a key that changes when the job changes, so the cost and note fields
 * always start from the saved values.
 */
export function PrintJobCard({ job, mode }: { job: PrintJob; mode: "supplier" | "admin" }) {
  const { pending, run: runAction } = useAction();
  const savedCost = job.unit_cost != null ? Number(job.unit_cost) : null;
  const savedNote = job.supplier_note ?? "";
  const [cost, setCost] = useState(savedCost != null ? String(savedCost) : "");
  const [note, setNote] = useState(savedNote);
  const [confirming, setConfirming] = useState(false);

  const isAdmin = mode === "admin";
  const cancelled = job.status === "cancelled";
  const statusLocked = !isAdmin && (cancelled || job.status === "received");
  const costLocked = !isAdmin && (job.paid || cancelled);
  // Compare as numbers, so "12.50" and 12.5 count as the same cost.
  const costNumber = cost.trim() === "" ? null : roundMoney(Number(cost));
  const costChanged = costNumber !== savedCost;
  const noteChanged = note.trim() !== savedNote.trim();
  const dirty = costChanged || noteChanged;
  const total = jobTotal(job);

  const run = (fn: () => Promise<{ error?: string }>, ok: string) => runAction(fn, ok, () => setConfirming(false));

  const setStatus = (status: PrintJobStatus, ok: string) => run(() => updateJob({ id: job.id, status }), ok);

  const save = () => {
    if (costNumber != null && (!Number.isFinite(costNumber) || costNumber < 0)) return void toast.error("Enter a valid cost");
    // Send only what was edited, so an untouched field never overwrites a newer value.
    run(
      () =>
        updateJob({
          id: job.id,
          ...(costChanged ? (costNumber == null ? { clearCost: true } : { unitCost: costNumber }) : {}),
          ...(noteChanged ? { note: note.trim() } : {}),
        }),
      "Saved",
    );
  };

  return (
    <li className="grid gap-4 px-5 py-5 text-sm">
      <div className="flex gap-4">
        <ProductImage src={job.image} alt={job.title} sizes="64px" className="size-16 shrink-0 rounded-lg border border-line" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
            <p className="min-w-0 text-base font-medium break-words">{job.title}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge color={JOB_STATUS_COLOR[job.status]}>{JOB_STATUS_LABEL[job.status]}</Badge>
              {job.paid ? <Badge color="success">Paid</Badge> : job.unit_cost != null && !cancelled && <Badge>Not paid</Badge>}
            </div>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-soft">
            <span className="rounded-md bg-ink px-2 py-0.5 text-xs font-semibold text-white tabular-nums">Qty {job.quantity}</span>
            {job.variant && <span className="font-medium text-ink">{job.variant}</span>}
            <span>
              {job.order_number ? (
                isAdmin && job.order_id ? (
                  <Link href={`/admin/orders/${job.order_id}`} className="underline-offset-4 hover:text-ink hover:underline">
                    Order {job.order_number}
                  </Link>
                ) : (
                  `Order ${job.order_number}`
                )
              ) : (
                "Added by hand"
              )}{" "}
              · {formatDay(job.created_at)}
            </span>
          </p>
          {job.details && (
            <p className="mt-2 inline-block rounded-md bg-warning/10 px-2.5 py-1.5 font-medium break-words text-ink">Details: {job.details}</p>
          )}
        </div>
      </div>

      {/* Cost and note */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg bg-surface p-3">
        <label className="grid gap-1">
          <span className="text-xs font-medium text-ink-soft">Cost per piece (৳)</span>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            disabled={costLocked || pending}
            placeholder="0"
            className="h-9 w-28"
          />
        </label>
        <label className="grid min-w-40 flex-1 gap-1">
          <span className="text-xs font-medium text-ink-soft">{isAdmin ? "Supplier's note" : "Note (optional)"}</span>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={cancelled && !isAdmin}
            maxLength={500}
            placeholder="e.g. filament used, print time"
            className="h-9"
          />
        </label>
        <Button size="sm" className="h-9" disabled={!dirty || pending} onClick={save}>
          Save
        </Button>
        <p className="ml-auto text-right">
          <span className="block text-xs text-ink-soft">Total for {job.quantity}</span>
          <span className="text-base font-semibold tabular-nums">{job.unit_cost != null ? formatBDT(total) : "No cost yet"}</span>
        </p>
      </div>

      {/* Actions */}
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ink-soft">Delete this job for good?</span>
          <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => deleteJob(job.id), "Job deleted")}>
            Delete
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
            Keep
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {!statusLocked && job.status === "to_print" && (
            <Button size="sm" disabled={pending} onClick={() => setStatus("printing", "Marked as printing")}>
              <Play className="size-4" /> Start printing
            </Button>
          )}
          {!statusLocked && job.status === "printing" && (
            <>
              <Button size="sm" variant="accent" disabled={pending} onClick={() => setStatus("printed", "Marked as printed")}>
                <Check className="size-4" /> Mark as printed
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => setStatus("to_print", "Moved back to To print")}>
                <Undo2 className="size-4" /> Not started
              </Button>
            </>
          )}
          {job.status === "printed" && (
            <>
              {isAdmin && (
                <Button size="sm" disabled={pending} onClick={() => setStatus("received", "Marked as received")}>
                  <PackageCheck className="size-4" /> Mark as received
                </Button>
              )}
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => setStatus("printing", "Moved back to Printing")}>
                <Undo2 className="size-4" /> Back to printing
              </Button>
            </>
          )}
          {isAdmin && job.status === "received" && (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setStatus("printed", "Moved back to Printed")}>
              <Undo2 className="size-4" /> Not received yet
            </Button>
          )}
          {isAdmin && cancelled && (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setStatus("to_print", "Job reopened")}>
              <Undo2 className="size-4" /> Reopen
            </Button>
          )}
          {statusLocked && <span className="text-ink-soft">{cancelled ? "This order was cancelled. Do not print it." : "The store has received this."}</span>}

          {isAdmin && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {job.paid ? (
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setJobUnpaid(job.id), "Marked as not paid")}>
                  Mark as not paid
                </Button>
              ) : (
                isDone(job.status) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending || job.unit_cost == null}
                    title={job.unit_cost == null ? "Set a cost first" : undefined}
                    onClick={() => run(() => payJobs([job.id], total), "Marked as paid")}
                  >
                    Mark as paid{job.unit_cost != null && ` ${formatBDT(total)}`}
                  </Button>
                )
              )}
              <Button size="sm" variant="ghost" className="text-ink-soft hover:text-danger" onClick={() => setConfirming(true)} aria-label="Delete job">
                <Trash2 className="size-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
