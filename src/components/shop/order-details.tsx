import type { TrackedOrder } from "@/lib/orders";
import { ADVANCE_STATUS_COLOR, ADVANCE_STATUS_LABEL, PAYMENT_STATUS_COLOR, PAYMENT_STATUS_LABEL } from "@/lib/orders";
import { Badge } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { getStoreSettings } from "@/lib/store-settings";
import { ProductImage } from "./product-image";
import { OrderProgress } from "./order-progress";
import { PAYMENT_LABEL, formatBDT, formatDate, variantLabel } from "@/lib/utils";

/** Shared order view used by the confirmation, tracking and account pages. */
export async function OrderDetails({ order }: { order: TrackedOrder }) {
  const store = await getStoreSettings();
  return (
    <div className="@container">
    <div className="grid gap-8 @4xl:grid-cols-[1fr_360px]">
      <div className="grid h-fit gap-8">
        <section className="rounded-xl border border-line p-6">
          <h2 className="mb-5 font-semibold">Order status</h2>
          <OrderProgress order={order} />
          {order.tracking_code && (
            <p className="mt-6 rounded-lg bg-surface px-4 py-3 text-sm">
              Shipped with <strong>{order.courier ?? "courier"}</strong>, tracking code{" "}
              <span className="font-mono font-medium">{order.tracking_code}</span>
              <CopyButton value={order.tracking_code} label="Copy tracking code" />
            </p>
          )}
        </section>

        <section className="rounded-xl border border-line">
          <h2 className="border-b border-line px-6 py-4 font-semibold">Items</h2>
          <ul className="divide-y divide-line">
            {order.items.map((it, i) => (
              <li key={i} className="flex items-center gap-4 px-6 py-4">
                <ProductImage src={it.image} alt={it.name} sizes="56px" className="size-14 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{it.name}</p>
                  <p className="text-ink-soft">
                    {variantLabel(it.options)}
                    {variantLabel(it.options) && " · "}Qty {it.quantity}
                  </p>
                  {it.details && <p className="mt-0.5 break-words text-ink-soft">Details: {it.details}</p>}
                </div>
                <span className="text-sm tabular-nums">{formatBDT(it.line_total)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <aside className="grid h-fit gap-6">
        <section className="rounded-xl bg-surface p-6">
          <h2 className="font-semibold">Summary</h2>
          <dl className="mt-4 grid gap-2.5 text-sm">
            <Row label="Placed" value={formatDate(order.created_at)} />
            <Row label="Subtotal" value={formatBDT(order.subtotal)} />
            {Number(order.discount) > 0 && <Row label="Discount" value={`−${formatBDT(order.discount)}`} />}
            <Row label="Delivery" value={Number(order.shipping_fee) === 0 ? "Free" : formatBDT(order.shipping_fee)} />
            <div className="mt-2 flex justify-between border-t border-line pt-3 text-base">
              <dt className="font-medium">Total</dt>
              <dd className="font-semibold tabular-nums">{formatBDT(order.total)}</dd>
            </div>
          </dl>
        </section>
        <section className="rounded-xl border border-line p-6 text-sm">
          <h2 className="font-semibold">Payment</h2>
          <p className="mt-2 flex items-center justify-between gap-2">
            {PAYMENT_LABEL[order.payment_method]}
            <Badge color={PAYMENT_STATUS_COLOR[order.payment_status]}>{PAYMENT_STATUS_LABEL[order.payment_status]}</Badge>
          </p>
          {order.advance_status && order.advance_status !== "none" && (
            <p className="mt-2 flex items-center justify-between gap-2">
              <span>
                Delivery charge {formatBDT(order.advance_amount)}
                {order.advance_method && <span className="text-ink-soft"> · {PAYMENT_LABEL[order.advance_method]}</span>}
              </span>
              <Badge color={ADVANCE_STATUS_COLOR[order.advance_status]}>{ADVANCE_STATUS_LABEL[order.advance_status]}</Badge>
            </p>
          )}
          <h2 className="mt-5 font-semibold">Delivering to</h2>
          <p className="mt-2 text-ink-soft">
            {order.customer_name}
            <br />
            {order.ship_area}, {order.ship_district}
          </p>
        </section>
        {(store.phone || store.facebook) && (
          <section className="rounded-xl border border-line p-6 text-sm">
            <h2 className="font-semibold">Need help with this order?</h2>
            <p className="mt-2 text-ink-soft">
              Tell us your order number, <span className="font-medium text-ink">{order.order_number}</span>.
            </p>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-medium">
              {store.phone && (
                <a href={`tel:${store.phone}`} className="text-accent hover:underline">
                  Call {store.phone}
                </a>
              )}
              {store.facebook && (
                <a href={store.facebook} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                  Message us on Facebook
                </a>
              )}
            </p>
          </section>
        )}
      </aside>
    </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}
