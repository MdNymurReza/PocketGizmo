import { Check } from "lucide-react";
import type { TrackedOrder } from "@/lib/orders";
import { ORDER_FLOW } from "@/lib/orders";
import { STATUS_LABEL, cn, formatDate } from "@/lib/utils";

/** What the customer can expect at each step. */
const WHAT_NEXT: Record<(typeof ORDER_FLOW)[number], string> = {
  pending: "We have your order. We will check it and confirm it soon.",
  confirmed: "Your order is confirmed. Printing starts next.",
  printing: "Your items are being printed. We ship them after a quality check.",
  shipped: "Your order is on its way. Please keep your phone nearby, the courier will call you.",
  delivered: "Your order was delivered. We hope you like it!",
};

/** Horizontal step tracker plus a dated history list. */
export function OrderProgress({ order }: { order: TrackedOrder }) {
  const cancelled = order.status === "cancelled";
  const current = ORDER_FLOW.indexOf(order.status as (typeof ORDER_FLOW)[number]);
  const reachedAt = (s: string) => order.history.filter((h) => h.status === s).at(-1)?.created_at;
  const waitingForPayment = order.payment_status === "pending_verification" || order.advance_status === "pending";

  return (
    <div>
      {cancelled ? (
        <p className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">This order was cancelled.</p>
      ) : (
        <>
          <p className="mb-5 rounded-lg bg-surface px-4 py-3 text-sm">
            {order.status === "pending" && waitingForPayment
              ? "We have your order. We are checking your payment and will confirm the order soon."
              : WHAT_NEXT[order.status as (typeof ORDER_FLOW)[number]]}
          </p>
          <ol className="grid grid-cols-5 gap-2">
            {ORDER_FLOW.map((s, i) => {
              const done = i <= current;
              return (
                <li key={s} className="min-w-0" aria-current={i === current ? "step" : undefined}>
                  <div className={cn("h-1.5 rounded-full", done ? (i === current ? "bg-accent" : "bg-ink") : "bg-surface-2")} />
                  <p className={cn("mt-2 truncate text-xs font-medium sm:text-sm", done ? "text-ink" : "text-ink-soft")}>{STATUS_LABEL[s]}</p>
                  {reachedAt(s) && <p className="hidden text-xs text-ink-soft sm:block">{formatDate(reachedAt(s)!).split(",")[0]}</p>}
                </li>
              );
            })}
          </ol>
        </>
      )}

      <ul className="mt-6 grid gap-4">
        {[...order.history].reverse().map((h, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", i === 0 ? "bg-ink text-white" : "bg-surface-2 text-ink-soft")}>
              <Check className="size-3" />
            </span>
            <div>
              <p className="font-medium">{STATUS_LABEL[h.status]}</p>
              {h.note && <p className="text-ink-soft">{h.note}</p>}
              <p className="text-xs text-ink-soft">{formatDate(h.created_at)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
