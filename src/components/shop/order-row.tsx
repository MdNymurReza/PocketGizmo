import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui";
import { ProductImage } from "./product-image";
import { ORDER_FLOW, ORDER_STATUS_COLOR } from "@/lib/orders";
import { STATUS_LABEL, cn, formatBDT, formatDay, type OrderStatus } from "@/lib/utils";

export type OrderSummary = {
  order_number: string;
  created_at: string;
  status: OrderStatus;
  total: number | string;
  order_items: { product_name: string; image: string | null; quantity: number }[];
};

export const ORDER_SUMMARY_SELECT = "order_number, created_at, status, total, order_items(product_name, image, quantity)";

/** One order in a list: photos, what was bought, status and total. */
export function OrderRow({ order }: { order: OrderSummary }) {
  const items = order.order_items;
  const count = items.reduce((n, i) => n + i.quantity, 0);
  const first = items[0]?.product_name ?? "Order";
  const more = items.length - 1;

  return (
    <Link
      href={`/account/orders/${order.order_number}`}
      className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface"
    >
      <div className="flex shrink-0 -space-x-3">
        {items.slice(0, 2).map((it, i) => (
          <ProductImage
            key={i}
            src={it.image}
            alt=""
            sizes="48px"
            className="size-12 rounded-lg border-2 border-white"
          />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {first}
          {more > 0 && <span className="text-ink-soft"> +{more} more</span>}
        </p>
        <p className="mt-0.5 truncate text-xs text-ink-soft">
          {order.order_number} · {formatDay(order.created_at)} · {count} item{count === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-4">
        <Badge color={ORDER_STATUS_COLOR[order.status]}>{STATUS_LABEL[order.status]}</Badge>
        <span className="text-sm font-medium tabular-nums sm:w-20 sm:text-right">{formatBDT(order.total)}</span>
      </div>
      <ChevronRight className="hidden size-4 shrink-0 text-ink-soft transition-transform group-hover:translate-x-0.5 sm:block" />
    </Link>
  );
}

/** Compact five-step progress bar for an order that is on its way. */
export function OrderSteps({ status }: { status: OrderStatus }) {
  const current = ORDER_FLOW.indexOf(status as (typeof ORDER_FLOW)[number]);
  return (
    <ol className="grid grid-cols-5 gap-1.5" aria-label={`Order progress: ${STATUS_LABEL[status]}`}>
      {ORDER_FLOW.map((s, i) => (
        <li key={s} className="min-w-0" aria-current={i === current ? "step" : undefined}>
          <div className={cn("h-1.5 rounded-full", i <= current ? "bg-ink" : "bg-surface-2")} />
          <p className={cn("mt-1.5 truncate text-xs", i === current ? "font-medium text-ink" : "text-ink-soft")}>{STATUS_LABEL[s]}</p>
        </li>
      ))}
    </ol>
  );
}
