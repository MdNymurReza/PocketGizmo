"use client";

import { useState, useTransition } from "react";
import { Ban, Check, Copy, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { setAdvanceStatus, setPhoneBlocked } from "@/app/admin/orders/actions";
import { Badge, Button, Card, Input } from "@/components/ui";
import { ADVANCE_STATUS_COLOR, ADVANCE_STATUS_LABEL } from "@/lib/orders";
import { PAYMENT_LABEL, formatBDT } from "@/lib/utils";

export type PhoneStats = { total: number; delivered: number; cancelled: number; blocked: boolean; block_reason: string | null };

/** How risky is this customer? Order history by phone, plus block/unblock. */
export function CustomerRisk({ orderId, phone, stats }: { orderId: string; phone: string; stats: PhoneStats }) {
  const [pending, start] = useTransition();
  const [reason, setReason] = useState("");
  const [copied, setCopied] = useState(false);
  const previous = Math.max(0, stats.total - 1); // excluding this order
  const risky = stats.cancelled > 0 || stats.blocked;

  const toggle = (block: boolean) =>
    start(async () => {
      const res = await setPhoneBlocked({ phone, reason, orderId }, block);
      if (res.error) return void toast.error(res.error);
      toast.success(block ? "Number blocked from ordering online" : "Number unblocked");
      setReason("");
    });

  return (
    <Card className={risky ? "border-danger/30 text-sm" : "text-sm"}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          {risky ? <ShieldAlert className="size-4 text-danger" /> : <ShieldCheck className="size-4 text-success" />}
          Customer check
        </h2>
        {stats.blocked && <Badge color="danger">Blocked</Badge>}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Other orders" value={previous} />
        <Stat label="Delivered" value={stats.delivered} tone={stats.delivered > 0 ? "text-success" : undefined} />
        <Stat label="Cancelled" value={stats.cancelled} tone={stats.cancelled > 0 ? "text-danger" : undefined} />
      </dl>
      <p className="mt-3 text-xs text-ink-soft">
        {stats.cancelled > 0
          ? "This number has cancelled orders before. Consider calling to confirm, or asking for an advance."
          : previous === 0
            ? "First order from this number."
            : "No cancellations from this number."}
        {stats.blocked && stats.block_reason && <span className="mt-1 block">Block reason: {stats.block_reason}</span>}
      </p>

      <button
        type="button"
        onClick={() =>
          navigator.clipboard?.writeText(phone).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
        }
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-ink"
      >
        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
        Copy number to check in your courier&apos;s fraud checker
      </button>

      <div className="mt-4 border-t border-line pt-4">
        {stats.blocked ? (
          <Button variant="secondary" size="sm" disabled={pending} onClick={() => toggle(false)}>
            Unblock this number
          </Button>
        ) : (
          <div className="grid gap-2">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional, e.g. refused parcel)" className="h-9" />
            <Button variant="danger" size="sm" disabled={pending} onClick={() => toggle(true)}>
              <Ban className="size-4" /> Block from ordering online
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg bg-surface px-2 py-2.5">
      <dd className={`text-lg font-semibold tabular-nums ${tone ?? ""}`}>{value}</dd>
      <dt className="text-xs text-ink-soft">{label}</dt>
    </div>
  );
}

/** Verify the delivery charge a COD customer paid in advance. */
export function AdvancePanel({
  order,
}: {
  order: {
    id: string;
    advance_amount: number;
    advance_method: string | null;
    advance_status: "none" | "pending" | "verified" | "rejected";
    sender_number: string | null;
    trx_id: string | null;
  };
}) {
  const [pending, start] = useTransition();
  const act = (v: "verified" | "rejected") =>
    start(async () => {
      const res = await setAdvanceStatus(order.id, v);
      if (res.error) return void toast.error(res.error);
      toast.success(v === "verified" ? "Delivery charge marked as received" : "Delivery charge rejected");
    });

  return (
    <Card className="text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Delivery charge (advance)</h2>
        <Badge color={ADVANCE_STATUS_COLOR[order.advance_status]}>{ADVANCE_STATUS_LABEL[order.advance_status]}</Badge>
      </div>
      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-ink-soft">Amount</dt>
          <dd className="font-medium tabular-nums">{formatBDT(order.advance_amount)}</dd>
        </div>
        <div>
          <dt className="text-ink-soft">Paid with</dt>
          <dd className="font-medium">{order.advance_method ? PAYMENT_LABEL[order.advance_method] : "—"}</dd>
        </div>
        <div>
          <dt className="text-ink-soft">Sender number</dt>
          <dd className="font-mono">{order.sender_number ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-ink-soft">TrxID</dt>
          <dd className="font-mono">{order.trx_id ?? "—"}</dd>
        </div>
      </dl>
      {order.advance_status === "pending" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" disabled={pending} onClick={() => act("verified")}>
            <Check className="size-4" /> Mark as received
          </Button>
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => act("rejected")}>
            Reject
          </Button>
        </div>
      )}
      {order.advance_status !== "pending" && (
        <p className="mt-3 text-xs text-ink-soft">
          The remaining amount is collected in cash on delivery.
        </p>
      )}
    </Card>
  );
}
