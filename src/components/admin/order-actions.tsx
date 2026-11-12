"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { toast } from "sonner";
import { saveShipping, setOrderStatus, setPaymentStatus } from "@/app/admin/orders/actions";
import { Button, Card, Field, Input, Select } from "@/components/ui";
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

export function OrderActions({ order }: { order: Order }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [note, setNote] = useState("");
  const [courier, setCourier] = useState(order.courier);
  const [tracking, setTracking] = useState(order.tracking_code);
  const cancelled = order.status === "cancelled";

  const run = (fn: () => Promise<{ error?: string }>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (res.error) return void toast.error(res.error);
      toast.success(ok);
      setNote("");
      router.refresh();
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
              <dd className="font-mono font-medium">{order.sender_number ?? "–"}</dd>
            </div>
            <div>
              <dt className="text-ink-soft">Transaction ID</dt>
              <dd className="font-mono font-medium">{order.trx_id ?? "–"}</dd>
            </div>
          </dl>
          {order.payment_status === "pending_verification" && !cancelled && (
            <>
              <p className="mt-4 flex gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                Check your {PAYMENT_LABEL[order.payment_method]} statement for {formatBDT(order.total)} with this TrxID before verifying.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button disabled={pending} onClick={() => run(() => setPaymentStatus(order.id, "paid"), "Payment verified")}>
                  Mark as paid
                </Button>
                <Button
                  variant="danger"
                  disabled={pending}
                  onClick={() => confirm("Reject this payment? You can then contact the customer or cancel the order.") && run(() => setPaymentStatus(order.id, "rejected"), "Payment rejected")}
                >
                  Reject payment
                </Button>
              </div>
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
            <h2 className="font-semibold">Update status</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
              <Field label="Status">
                <Select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
                  {ORDER_STATUSES.filter((s) => s !== "cancelled").map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Note to customer (optional)">
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Printing started today" />
              </Field>
              <Button
                disabled={pending || status === order.status}
                onClick={() => run(() => setOrderStatus({ id: order.id, status, note }), `Order marked ${STATUS_LABEL[status].toLowerCase()}`)}
              >
                Update
              </Button>
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold">Shipping</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Courier">
                <Input value={courier} onChange={(e) => setCourier(e.target.value)} list="couriers" placeholder="e.g. Steadfast" />
                <datalist id="couriers">
                  {COURIERS.map((c) => <option key={c} value={c} />)}
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

          <div className="flex justify-end">
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => {
                const reason = prompt("Cancel this order? Stock will be returned to inventory.\n\nReason (shown to the customer):", "");
                if (reason === null) return;
                run(() => setOrderStatus({ id: order.id, status: "cancelled", note: reason }), "Order cancelled and stock restored");
              }}
            >
              Cancel order
            </Button>
          </div>
        </>
      )}
    </>
  );
}
