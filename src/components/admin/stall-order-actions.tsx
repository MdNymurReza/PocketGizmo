"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Printer, Undo2 } from "lucide-react";
import { deleteStallOrder, deliverStallOrder, recordStallPayment, setStallStatus } from "@/app/admin/stall/actions";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { STALL_FLOW, STALL_NEXT, STALL_PAYMENT_METHODS, STALL_STATUS_LABEL, type StallStatus } from "@/lib/stall";
import { useAction } from "@/lib/use-action";
import { formatBDT } from "@/lib/utils";

/** Status, payment, receipt and delete controls for one stall order. */
export function StallOrderActions({ order }: { order: { id: string; status: StallStatus; total: number; paid: number } }) {
  const router = useRouter();
  const { pending, run } = useAction();
  const due = Math.max(0, order.total - order.paid);
  const [amount, setAmount] = useState(due > 0 ? String(due) : "");
  const [method, setMethod] = useState("Cash");
  const [asking, setAsking] = useState<"cancel" | "delete" | null>(null);
  const cancelled = order.status === "cancelled";
  const next = STALL_NEXT[order.status];
  const previous = STALL_FLOW[STALL_FLOW.indexOf(order.status as (typeof STALL_FLOW)[number]) - 1];

  return (
    <div className="grid gap-6 print:hidden">
      <Card>
        <h2 className="font-semibold">Next step</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {next ? (
            <>
              <Button variant="accent" disabled={pending} onClick={() => run(() => deliverStallOrder(order.id, true), due > 0 ? `Delivered, ${formatBDT(due)} received` : "Marked as delivered")}>
                <Check className="size-4" /> {due > 0 ? `Delivered, got ${formatBDT(due)}` : "Delivered"}
              </Button>
              {next.to !== "delivered" && (
                <Button variant="secondary" disabled={pending} onClick={() => run(() => setStallStatus(order.id, next.to), next.ok)}>
                  {next.label} <ArrowRight className="size-4" />
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-ink-soft">{cancelled ? "This order is cancelled." : "This order is delivered."}</p>
          )}
          {cancelled ? (
            <Button variant="secondary" disabled={pending} onClick={() => run(() => setStallStatus(order.id, "new"), "Order reopened")}>
              <Undo2 className="size-4" /> Reopen order
            </Button>
          ) : (
            previous && (
              <Button variant="ghost" disabled={pending} onClick={() => run(() => setStallStatus(order.id, previous), `Moved back to ${STALL_STATUS_LABEL[previous]}`)}>
                <Undo2 className="size-4" /> Back to {STALL_STATUS_LABEL[previous].toLowerCase()}
              </Button>
            )
          )}
          <Button variant="secondary" className="ml-auto" onClick={() => window.print()}>
            <Printer className="size-4" /> Print receipt
          </Button>
        </div>
        {next && due > 0 && (
          <p className="mt-3 text-sm text-ink-soft">
            “Delivered, got {formatBDT(due)}” also saves the rest as paid in cash.{" "}
            <button
              type="button"
              disabled={pending}
              className="font-medium text-ink underline underline-offset-4"
              onClick={() => run(() => deliverStallOrder(order.id, false), "Delivered, payment still open")}
            >
              Delivered, but not paid yet
            </button>
          </p>
        )}
      </Card>

      {!cancelled && (
        <Card>
          <h2 className="font-semibold">Take a payment</h2>
          {due > 0 ? (
            <form
              className="mt-4 grid gap-3 sm:grid-cols-[140px_140px_auto] sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => recordStallPayment(order.id, Number(amount), method), "Payment saved");
              }}
            >
              <Field label="Amount (৳)">
                <Input type="number" inputMode="decimal" min={0} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </Field>
              <Field label="Paid by">
                <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                  {STALL_PAYMENT_METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" disabled={pending || !(Number(amount) > 0)}>
                Save payment
              </Button>
            </form>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">Paid in full.</p>
          )}
          {order.paid > 0 && (
            <button
              type="button"
              disabled={pending}
              className="mt-3 text-sm text-ink-soft underline underline-offset-4 hover:text-ink"
              onClick={() => run(() => recordStallPayment(order.id, -order.paid, ""), "Payments cleared")}
            >
              Entered a payment by mistake? Set paid back to ৳0
            </button>
          )}
        </Card>
      )}

      {asking ? (
        <Card className="border-danger/30">
          <p className="text-sm">
            {asking === "cancel"
              ? "Cancel this order? Print jobs that are not printed yet are cancelled too. The order stays in the list."
              : "Delete this order for good? Use this only for an order entered by mistake."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                asking === "cancel"
                  ? run(() => setStallStatus(order.id, "cancelled"), "Order cancelled", () => setAsking(null))
                  : run(() => deleteStallOrder(order.id), "Order deleted", () => router.push("/admin/stall"))
              }
            >
              {asking === "cancel" ? "Cancel order" : "Delete order"}
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => setAsking(null)}>
              Keep order
            </Button>
          </div>
        </Card>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          {!cancelled && order.status !== "delivered" && (
            <Button variant="danger" disabled={pending} onClick={() => setAsking("cancel")}>
              Cancel order
            </Button>
          )}
          <Button variant="ghost" className="text-ink-soft hover:text-danger" disabled={pending} onClick={() => setAsking("delete")}>
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}
