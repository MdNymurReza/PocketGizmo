import { Check } from "lucide-react";
import type { TrackedOrder } from "@/lib/orders";
import { ORDER_FLOW } from "@/lib/orders";
import { STATUS_LABEL, cn, formatDate } from "@/lib/utils";

/** Horizontal step tracker plus a dated history list. */
export function OrderProgress({ order }: { order: TrackedOrder }) {
  const cancelled = order.status === "cancelled";
  const current = ORDER_FLOW.indexOf(order.status as (typeof ORDER_FLOW)[number]);
  const reachedAt = (s: string) => order.history.filter((h) => h.status === s).at(-1)?.created_at;

  return (
    <div>
      {cancelled ? (
        <p className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">This order was cancelled.</p>
      ) : (
        <ol className="grid grid-cols-5 gap-2">
          {ORDER_FLOW.map((s, i) => {
            const done = i <= current;
            return (
              <li key={s} className="min-w-0">
                <div className={cn("h-1.5 rounded-full", done ? "bg-ink" : "bg-surface-2")} />
                <p className={cn("mt-2 truncate text-xs font-medium sm:text-sm", done ? "text-ink" : "text-ink-soft")}>
                  {STATUS_LABEL[s]}
                </p>
                {reachedAt(s) && <p className="hidden text-xs text-ink-soft sm:block">{formatDate(reachedAt(s)!).split(",")[0]}</p>}
              </li>
            );
          })}
        </ol>
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
