import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card } from "@/components/ui";
import { ProductImage } from "@/components/shop/product-image";
import { OrderActions } from "@/components/admin/order-actions";
import { SendToPrint } from "@/components/admin/send-to-print";
import { AdvancePanel, CustomerRisk } from "@/components/admin/customer-risk";
import { ORDER_STATUS_COLOR, PAYMENT_STATUS_COLOR, PAYMENT_STATUS_LABEL } from "@/lib/orders";
import { ZONE_LABEL } from "@/lib/bd";
import { PAYMENT_LABEL, STATUS_LABEL, formatBDT, formatDate, variantLabel } from "@/lib/utils";

export const metadata: Metadata = { title: "Order" };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: o } = await supabase
    .from("orders")
    .select("*, order_items(*), order_status_history(*)")
    .eq("id", id)
    .maybeSingle();
  if (!o) notFound();
  const { data: statsRows } = await supabase.rpc("admin_phone_stats", { p_phones: [o.customer_phone] });
  const stats = statsRows?.[0] ?? { total: 1, delivered: 0, cancelled: 0, blocked: false, block_reason: null };
  const { count: printJobs } = await supabase.from("print_jobs").select("id", { count: "exact", head: true }).eq("order_id", o.id);
  const history = [...o.order_status_history].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <>
      <Link href="/admin/orders" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ChevronLeft className="size-4" /> Orders
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{o.order_number}</h1>
        <Badge color={ORDER_STATUS_COLOR[o.status]}>{STATUS_LABEL[o.status]}</Badge>
        <Badge color={PAYMENT_STATUS_COLOR[o.payment_status]}>{PAYMENT_STATUS_LABEL[o.payment_status]}</Badge>
        <span className="text-sm text-ink-soft">{formatDate(o.created_at)}</span>
        <span className="ml-auto">
          <SendToPrint orderId={o.id} sent={Boolean(printJobs)} cancelled={o.status === "cancelled"} />
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="grid h-fit gap-6">
          <Card className="p-0">
            <h2 className="border-b border-line px-5 py-3 font-semibold">Items</h2>
            <ul className="divide-y divide-line">
              {o.order_items.map((it) => (
                <li key={it.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                  <ProductImage src={it.image} alt={it.product_name} sizes="48px" className="size-12 shrink-0 rounded-md" />
                  <div className="min-w-0 flex-1">
                    {it.product_id ? (
                      <Link href={`/admin/products/${it.product_id}`} className="font-medium hover:text-accent">{it.product_name}</Link>
                    ) : (
                      <p className="font-medium">{it.product_name}</p>
                    )}
                    <p className="text-ink-soft">{variantLabel(it.variant_options as Record<string, string>)}</p>
                    {it.details && (
                      <p className="mt-1.5 inline-block rounded-md bg-warning/10 px-2 py-1 font-medium break-words text-ink">
                        Customer details: {it.details}
                      </p>
                    )}
                  </div>
                  <span className="text-ink-soft tabular-nums">{formatBDT(it.unit_price)} × {it.quantity}</span>
                  <span className="w-20 text-right font-medium tabular-nums">{formatBDT(it.line_total)}</span>
                </li>
              ))}
            </ul>
            <dl className="grid gap-2 border-t border-line px-5 py-4 text-sm">
              <Row label="Subtotal" value={formatBDT(o.subtotal)} />
              {Number(o.discount) > 0 && <Row label={`Discount${o.coupon_code ? ` (${o.coupon_code})` : ""}`} value={`−${formatBDT(o.discount)}`} />}
              <Row label={`Delivery (${ZONE_LABEL[o.ship_zone]})`} value={formatBDT(o.shipping_fee)} />
              <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatBDT(o.total)}</dd>
              </div>
            </dl>
          </Card>

          {o.advance_status !== "none" && (
            <AdvancePanel
              order={{
                id: o.id,
                advance_amount: Number(o.advance_amount),
                advance_method: o.advance_method,
                advance_status: o.advance_status,
                sender_number: o.sender_number,
                trx_id: o.trx_id,
              }}
            />
          )}

          <OrderActions
            order={{
              id: o.id,
              status: o.status,
              payment_method: o.payment_method,
              payment_status: o.payment_status,
              sender_number: o.sender_number,
              trx_id: o.trx_id,
              total: Number(o.total),
              courier: o.courier ?? "",
              tracking_code: o.tracking_code ?? "",
            }}
          />
        </div>

        <div className="grid h-fit gap-6">
          <CustomerRisk orderId={o.id} phone={o.customer_phone} stats={stats} />
          <Card className="text-sm">
            <h2 className="font-semibold">Customer</h2>
            <p className="mt-2">{o.customer_name}</p>
            <p>
              <a href={`tel:${o.customer_phone}`} className="text-accent hover:underline">{o.customer_phone}</a>
            </p>
            {o.customer_email && <p className="text-ink-soft">{o.customer_email}</p>}
            <p className="mt-1 text-xs text-ink-soft">{o.user_id ? "Registered customer" : "Guest checkout"}</p>

            <h2 className="mt-5 font-semibold">Delivery address</h2>
            <p className="mt-2 text-ink-soft">
              {o.ship_line}
              <br />
              {o.ship_area}, {o.ship_district}
              <br />
              {ZONE_LABEL[o.ship_zone]}
            </p>
            {o.note && (
              <>
                <h2 className="mt-5 font-semibold">Customer note</h2>
                <p className="mt-2 rounded-md bg-surface p-3 text-ink-soft">{o.note}</p>
              </>
            )}

            <h2 className="mt-5 font-semibold">Payment</h2>
            <p className="mt-2">
              {PAYMENT_LABEL[o.payment_method]}
              {o.advance_status !== "none" && <span className="text-ink-soft"> · delivery charge paid in advance</span>}
            </p>
          </Card>

          <Card className="text-sm">
            <h2 className="mb-4 font-semibold">History</h2>
            <ol className="grid gap-4 border-l border-line pl-4">
              {history.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-ink ring-4 ring-white" />
                  <p className="font-medium">{STATUS_LABEL[h.status]}</p>
                  {h.note && <p className="text-ink-soft">{h.note}</p>}
                  <p className="text-xs text-ink-soft">{formatDate(h.created_at)}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
