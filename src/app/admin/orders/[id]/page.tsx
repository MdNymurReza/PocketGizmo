import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download, Gift, MessageSquareText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card } from "@/components/ui";
import { ProductImage } from "@/components/shop/product-image";
import { OrderActions } from "@/components/admin/order-actions";
import { SendToPrint } from "@/components/admin/send-to-print";
import { CourierPanel } from "@/components/admin/courier-panel";
import { amountDue } from "@/lib/sms";
import { steadfastConfigured, steadfastTrackingUrl } from "@/lib/steadfast";
import { CopyButton } from "@/components/copy-button";
import { AdvancePanel, CustomerRisk } from "@/components/admin/customer-risk";
import { ORDER_STATUS_COLOR, PAYMENT_STATUS_COLOR, PAYMENT_STATUS_LABEL } from "@/lib/orders";
import { ZONE_LABEL, normalizePhone } from "@/lib/bd";
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
  const [{ data: statsRows }, { data: jobRows }, { data: smsRows }] = await Promise.all([
    supabase.rpc("admin_phone_stats", { p_phones: [o.customer_phone] }),
    supabase.from("print_jobs").select("unit_cost, quantity, status").eq("order_id", o.id),
    supabase.from("sms_log").select("id, event, ok, error, created_at").eq("order_id", o.id).order("created_at"),
  ]);
  const receipt = `/api/receipt/${encodeURIComponent(o.order_number)}?t=${o.tracking_token}`;
  const printJobs = jobRows?.length ?? 0;
  // Profit: what the items sold for, minus what the supplier charges to print them. Delivery is not counted.
  const liveJobs = (jobRows ?? []).filter((j) => j.status !== "cancelled");
  const printCost = liveJobs.reduce((n, j) => n + Number(j.unit_cost ?? 0) * j.quantity, 0);
  const jobsWithoutCost = liveJobs.filter((j) => j.unit_cost == null).length;
  const itemSales = Number(o.subtotal) - Number(o.discount) - Number(o.deal_discount) - Number(o.points_discount) + Number(o.gift_fee);
  const stats = statsRows?.[0] ?? { total: 1, delivered: 0, cancelled: 0, blocked: false, block_reason: null };
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
                    {it.preorder_qty > 0 && (
                      <p className="mt-1 text-xs font-medium text-info">Pre-order: {it.preorder_qty} of {it.quantity} not in stock yet, print them</p>
                    )}
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
              {Number(o.deal_discount) > 0 && <Row label={`Deal${o.deal_name ? ` (${o.deal_name})` : ""}`} value={`−${formatBDT(o.deal_discount)}`} />}
              {Number(o.discount) > 0 && <Row label={`Discount${o.coupon_code ? ` (${o.coupon_code})` : ""}`} value={`−${formatBDT(o.discount)}`} />}
              {Number(o.points_discount) > 0 && <Row label={`Points (${o.points_used})`} value={`−${formatBDT(o.points_discount)}`} />}
              {Number(o.gift_fee) > 0 && <Row label="Gift wrap" value={formatBDT(o.gift_fee)} />}
              <Row label={`Delivery (${ZONE_LABEL[o.ship_zone]})`} value={formatBDT(o.shipping_fee)} />
              <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatBDT(o.total)}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-5 py-3 text-sm">
              <a href={receipt} className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline">
                <Download className="size-4" /> Receipt PDF
              </a>
              <a href={`${receipt}&gift=1`} className="inline-flex items-center gap-1.5 text-ink-soft hover:text-ink">
                <Gift className="size-4" /> Packing slip without prices
              </a>
            </div>
          </Card>

          {o.gift_wrap && (
            <Card className="border-accent/30 bg-accent/5 text-sm">
              <h2 className="flex items-center gap-2 font-semibold"><Gift className="size-4 text-accent" /> Gift wrap this order</h2>
              {o.gift_message ? (
                <p className="mt-2 rounded-md bg-white p-3 break-words">&ldquo;{o.gift_message}&rdquo;</p>
              ) : (
                <p className="mt-2 text-ink-soft">No message for the card.</p>
              )}
              {o.gift_hide_prices && <p className="mt-2 text-xs text-ink-soft">The customer asked for no prices in the parcel: put in the packing slip without prices.</p>}
            </Card>
          )}

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

          {o.status !== "cancelled" && o.status !== "delivered" && (
            <CourierPanel
              order={{ id: o.id, status: o.status, courier: o.courier, tracking_code: o.tracking_code, consignment_id: o.consignment_id, due: amountDue(o) }}
              ready={steadfastConfigured()}
              trackingUrl={o.courier === "Steadfast" && o.tracking_code ? steadfastTrackingUrl(o.tracking_code) : null}
            />
          )}
        </div>

        <div className="grid h-fit gap-6">
          <CustomerRisk orderId={o.id} phone={o.customer_phone} stats={stats} />
          <Card className="text-sm">
            <h2 className="font-semibold">Customer</h2>
            <p className="mt-2">{o.customer_name}</p>
            <p className="flex flex-wrap items-center gap-x-2">
              <a href={`tel:${o.customer_phone}`} className="text-accent hover:underline">{o.customer_phone}</a>
              <CopyButton value={o.customer_phone} label="Copy phone number" />
              <a
                href={`https://wa.me/88${normalizePhone(o.customer_phone)}?text=${encodeURIComponent(`Hello ${o.customer_name}, this is PocketGizmo about your order ${o.order_number}.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink-soft underline-offset-4 hover:text-ink hover:underline"
              >
                WhatsApp
              </a>
            </p>
            {o.customer_email && <p className="text-ink-soft">{o.customer_email}</p>}
            <p className="mt-1 text-xs text-ink-soft">{o.user_id ? "Registered customer" : "Guest checkout"}</p>

            <h2 className="mt-5 flex items-center gap-1 font-semibold">
              Delivery address
              <CopyButton
                value={`${o.customer_name}\n${o.customer_phone}\n${o.ship_line}, ${o.ship_area}, ${o.ship_district}`}
                label="Copy name, phone and address (for the courier)"
              />
            </h2>
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

          {o.status !== "cancelled" && (
            <Card className="text-sm">
              <h2 className="font-semibold">Profit</h2>
              {liveJobs.length === 0 ? (
                <p className="mt-2 text-ink-soft">Send this order to print. When the supplier enters the print cost, the profit shows here.</p>
              ) : (
                <>
                  <dl className="mt-3 grid gap-2">
                    <Row label="Items sold (after discount)" value={formatBDT(itemSales)} />
                    <Row label="Print cost" value={`−${formatBDT(printCost)}`} />
                    <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
                      <dt>{jobsWithoutCost ? "Profit so far" : "Profit"}</dt>
                      <dd className={itemSales - printCost < 0 ? "text-danger tabular-nums" : "tabular-nums"}>{formatBDT(itemSales - printCost)}</dd>
                    </div>
                  </dl>
                  {jobsWithoutCost > 0 && (
                    <p className="mt-3 rounded-md bg-warning/10 px-3 py-2 text-xs">
                      {jobsWithoutCost} print job{jobsWithoutCost === 1 ? " has" : "s have"} no cost yet, so the real profit is lower.
                    </p>
                  )}
                  <p className="mt-3 text-xs text-ink-soft">The delivery charge is not counted. It goes to the courier.</p>
                </>
              )}
            </Card>
          )}

          {(smsRows?.length ?? 0) > 0 && (
            <Card className="text-sm">
              <h2 className="flex items-center gap-2 font-semibold"><MessageSquareText className="size-4" /> SMS sent</h2>
              <ul className="mt-3 grid gap-1.5">
                {smsRows!.map((m) => (
                  <li key={m.id} className="flex justify-between gap-3">
                    <span className="capitalize">{m.event.replace(/_/g, " ")}</span>
                    <span className={m.ok ? "text-success" : "text-danger"}>{m.ok ? formatDate(m.created_at) : (m.error ?? "Failed")}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

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
