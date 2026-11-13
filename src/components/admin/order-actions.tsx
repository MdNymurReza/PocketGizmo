"use client";

import { useState } from "react";
import { ArrowRight, CircleAlert } from "lucide-react";
import { saveShipping, setOrderStatus, setPaymentStatus } from "@/app/admin/orders/actions";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { useAction } from "@/lib/use-action";
import { ORDER_STATUSES, PAYMENT_LABEL, STATUS_LABEL, formatBDT, type OrderStatus } from "@/lib/utils";

type Order = {
  id: string;
  status: OrderStatus;
  payment_method: string;
  payment_status: string;
  sender_number: string | null;
  trx_id: string | null;
  total: number;
  courier: string;
  tracking_code: string;
};

const COURIERS = ["Steadfast", "Pathao", "RedX", "Sundarban", "SA Paribahan", "eCourier", "Paperfly", "Self delivery"];

/** The usual next step for an order, offered as one button. Shipping has its own card, because it needs a courier. */
const NEXT_STEP: Partial<Record<OrderStatus, { to: OrderStatus; label: string; text: string; ok: string }>> = {
  pending: { to: "confirmed", label: "Confirm order", text: "Confirming also puts the items on the supplier's print list.", ok: "Order confirmed" },
  confirmed: { to: "printing", label: "Start printing", text: "The customer will see that printing has started.", ok: "Order marked as printing" },
  shipped: { to: "delivered", label: "Mark as delivered", text: "Use this when the courier has handed over the parcel.", ok: "Order marked as delivered" },
};

export function OrderActions({ order }: { order: Order }) {
  const { pending, run: runAction } = useAction();
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [note, setNote] = useState("");
  const [courier, setCourier] = useState(order.courier);
  const [tracking, setTracking] = useState(order.tracking_code);
  const [rejecting, setRejecting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const cancelled = order.status === "cancelled";
  const next = NEXT_STEP[order.status];
  const waitingForPayment = order.payment_status === "pending_verification";

  const run = (fn: () => Promise<{ error?: string }>, ok: string) =>
    runAction(fn, ok, () => {
      setNote("");
      setRejecting(false);
      setCancelling(false);
    });

  return (
    <>
      {order.payment_method !== "cod" && (
        <Card>
          <h2 className="font-semibold">Payment verification</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-ink-soft">Method</dt>
              <dd className="font-medium">{PAYMENT_LABEL[order.payment_method]}</dd>
            </div>
            <div>
              <dt className="text-ink-soft">Sender number</dt>
              <dd className="font-mono font-medium">
                {order.sender_number ?? "–"}
                {order.sender_number && <CopyButton value={order.sender_number} label="Copy sender number" />}
              </dd>
            </div>
            <div>
              <dt className="text-ink-soft">Transaction ID</dt>
              <dd className="font-mono font-medium">
                {order.trx_id ?? "–"}
                {order.trx_id && <CopyButton value={order.trx_id} label="Copy transaction ID" />}
              </dd>
            </div>
          </dl>
          {waitingForPayment && !cancelled && (
            <>
              <p className="mt-4 flex gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                Check your {PAYMENT_LABEL[order.payment_method]} statement for {formatBDT(order.total)} with this TrxID before verifying.
              </p>
              {rejecting ? (
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-ink-soft">Reject this payment? You can then contact the customer or cancel the order.</span>
                  <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => setPaymentStatus(order.id, "rejected"), "Payment rejected")}>
                    Yes, reject
                  </Button>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => setRejecting(false)}>
                    Keep
                  </Button>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button disabled={pending} onClick={() => run(() => setPaymentStatus(order.id, "paid"), "Payment verified")}>
                    Mark as paid
                  </Button>
                  <Button variant="danger" disabled={pending} onClick={() => setRejecting(true)}>
                    Reject payment
                  </Button>
                </div>
              )}
            </>
          )}
          {order.payment_status === "rejected" && !cancelled && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" disabled={pending} onClick={() => run(() => setPaymentStatus(order.id, "paid"), "Payment verified")}>
                Mark as paid after all
              </Button>
            </div>
          )}
          {order.payment_status === "paid" && cancelled && (
            <div className="mt-4">
              <Button variant="secondary" disabled={pending} onClick={() => run(() => setPaymentStatus(order.id, "refunded"), "Marked as refunded")}>
                Mark as refunded
              </Button>
            </div>
          )}
        </Card>
      )}

      {!cancelled && (
        <>
          <Card>
            <h2 className="font-semibold">Next step</h2>
            {next ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-md text-sm text-ink-soft">
                  {order.status === "pending" && waitingForPayment ? "Check the payment above first. " : ""}
                  {next.text}
                </p>
                <Button variant="accent" disabled={pending} onClick={() => run(() => setOrderStatus({ id: order.id, status: next.to, note: "" }), next.ok)}>
                  {next.label} <ArrowRight className="size-4" />
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink-soft">
                {order.status === "printing"
                  ? "When the items are packed, enter the courier below and click “Save & mark shipped”."
                  : "This order is delivered. Nothing more to do."}
              </p>
            )}

            <details className="mt-4 border-t border-line pt-3 text-sm">
              <summary className="cursor-pointer font-medium text-ink-soft hover:text-ink">Set another status, or add a note for the customer</summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
                <Field label="Status">
                  <Select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
                    {ORDER_STATUSES.filter((s) => s !== "cancelled").map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Note to customer (optional)">
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Printing started today" />
                </Field>
                <Button
                  variant="secondary"
                  disabled={pending || status === order.status}
                  onClick={() => run(() => setOrderStatus({ id: order.id, status, note }), `Order marked ${STATUS_LABEL[status].toLowerCase()}`)}
                >
                  Update
                </Button>
              </div>
            </details>
          </Card>

          <Card>
            <h2 className="font-semibold">Shipping</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Courier">
                <Input value={courier} onChange={(e) => setCourier(e.target.value)} list="couriers" placeholder="e.g. Steadfast" />
                <datalist id="couriers">
                  {COURIERS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Tracking / consignment ID">
                <Input value={tracking} onChange={(e) => setTracking(e.target.value)} className="font-mono" />
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {order.status !== "shipped" && order.status !== "delivered" && (
                <Button
                  disabled={pending}
                  onClick={() => run(() => saveShipping({ id: order.id, courier, tracking_code: tracking, markShipped: true }), "Order marked as shipped")}
                >
                  Save &amp; mark shipped
                </Button>
              )}
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() => run(() => saveShipping({ id: order.id, courier, tracking_code: tracking, markShipped: false }), "Shipping details saved")}
              >
                Save details
              </Button>
            </div>
          </Card>

          {cancelling ? (
            <Card className="border-danger/30">
              <h2 className="font-semibold">Cancel this order?</h2>
              <p className="mt-1 text-sm text-ink-soft">Stock goes back to inventory, and print jobs that are not printed yet are cancelled.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                <Field label="Reason (the customer sees this, optional)">
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer asked to cancel" autoFocus />
                </Field>
                <Button
                  variant="danger"
                  disabled={pending}
                  onClick={() => run(() => setOrderStatus({ id: order.id, status: "cancelled", note: reason }), "Order cancelled and stock restored")}
                >
                  Cancel order
                </Button>
                <Button variant="ghost" disabled={pending} onClick={() => setCancelling(false)}>
                  Keep order
                </Button>
              </div>
            </Card>
          ) : (
            <div className="flex justify-end">
              <Button variant="danger" disabled={pending} onClick={() => setCancelling(true)}>
                Cancel order
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
