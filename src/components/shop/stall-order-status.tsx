import type { Database } from "@/lib/database.types";
import { Badge } from "@/components/ui";
import { STALL_FLOW, STALL_PICKUP_POINT, STALL_STATUS_COLOR, STALL_STATUS_LABEL } from "@/lib/stall";
import { cn, formatBDT, formatDay } from "@/lib/utils";

export type TrackedStallOrder = NonNullable<Database["public"]["Functions"]["track_stall_order"]["Returns"]>;

const WHAT_NEXT = {
  new: "We have your order. Printing starts soon.",
  printing: "Your items are being printed.",
  ready: "Your order is ready.",
  delivered: "Your order was handed over. We hope you like it!",
  cancelled: "This order was cancelled.",
} as const;

/** What a customer sees when they track an order they placed at the stall. */
export function StallOrderStatus({ order }: { order: TrackedStallOrder }) {
  const current = STALL_FLOW.indexOf(order.status as (typeof STALL_FLOW)[number]);
  const due = Math.max(0, Number(order.total) - Number(order.paid_amount));
  const cancelled = order.status === "cancelled";

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <section className="rounded-xl border border-line p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Order status</h2>
          <Badge color={STALL_STATUS_COLOR[order.status]}>{STALL_STATUS_LABEL[order.status]}</Badge>
        </div>
        <p className={cn("rounded-lg px-4 py-3 text-sm", cancelled ? "border border-danger/20 bg-danger/5 text-danger" : "bg-surface")}>
          {WHAT_NEXT[order.status]}
          {order.status === "ready" && (order.fulfilment === "pickup" ? ` You can collect it at ${STALL_PICKUP_POINT}.` : " We will send it to you soon.")}
          {!cancelled && order.status !== "delivered" && order.due_date && ` Promised for ${formatDay(order.due_date)}.`}
        </p>
        {!cancelled && order.fulfilment === "pickup" && order.status !== "delivered" && (
          <p className="mt-3 text-sm">
            <span className="text-ink-soft">Pickup point:</span> <span className="font-medium">{STALL_PICKUP_POINT}</span>
          </p>
        )}
        {!cancelled && (
          <ol className="mt-5 grid grid-cols-4 gap-2">
            {STALL_FLOW.map((s, i) => (
              <li key={s} className="min-w-0" aria-current={i === current ? "step" : undefined}>
                <div className={cn("h-1.5 rounded-full", i <= current ? (i === current ? "bg-accent" : "bg-ink") : "bg-surface-2")} />
                <p className={cn("mt-2 truncate text-xs font-medium sm:text-sm", i <= current ? "text-ink" : "text-ink-soft")}>{STALL_STATUS_LABEL[s]}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-xl border border-line">
        <h2 className="border-b border-line px-6 py-4 font-semibold">Items</h2>
        <ul className="divide-y divide-line">
          {order.items.map((it, i) => (
            <li key={i} className="flex items-start gap-4 px-6 py-4 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium break-words">
                  {it.name} <span className="font-normal text-ink-soft">× {it.quantity}</span>
                </p>
                {it.details && <p className="mt-0.5 break-words text-ink-soft">{it.details}</p>}
              </div>
              <span className="tabular-nums">{formatBDT(it.line_total)}</span>
            </li>
          ))}
        </ul>
        <dl className="grid gap-2 border-t border-line px-6 py-4 text-sm">
          {Number(order.discount) > 0 && <Row label="Discount" value={`−${formatBDT(order.discount)}`} />}
          {Number(order.delivery_charge) > 0 && <Row label="Delivery" value={formatBDT(order.delivery_charge)} />}
          <Row label="Total" value={formatBDT(order.total)} strong />
          <Row label="Paid" value={formatBDT(order.paid_amount)} />
          {!cancelled && <Row label={order.fulfilment === "pickup" ? "To pay when you collect" : "To pay on delivery"} value={formatBDT(due)} strong />}
        </dl>
      </section>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", strong && "font-semibold")}>
      <dt className={strong ? "" : "text-ink-soft"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
