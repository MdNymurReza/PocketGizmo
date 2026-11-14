import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { StallOrderActions } from "@/components/admin/stall-order-actions";
import { normalizePhone } from "@/lib/bd";
import { FULFILMENT_LABEL, STALL_PICKUP_POINT, STALL_STATUS_COLOR, STALL_STATUS_LABEL } from "@/lib/stall";
import { cn, formatBDT, formatDate, formatDay } from "@/lib/utils";

export const metadata: Metadata = { title: "Stall order" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");

export default async function StallOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: o }, { data: jobs }] = await Promise.all([
    supabase.from("stall_orders").select("*, stall_order_items(*)").eq("id", id).maybeSingle(),
    supabase.from("print_jobs").select("unit_cost, quantity, status").eq("stall_order_id", id),
  ]);
  if (!o) notFound();

  const total = Number(o.total);
  const paid = Number(o.paid_amount);
  const due = Math.max(0, total - paid);
  // Profit: what the items sold for, minus what the supplier charges to print them.
  const liveJobs = (jobs ?? []).filter((j) => j.status !== "cancelled");
  const printCost = liveJobs.reduce((n, j) => n + Number(j.unit_cost ?? 0) * j.quantity, 0);
  const jobsWithoutCost = liveJobs.filter((j) => j.unit_cost == null).length;
  const itemSales = Number(o.subtotal) - Number(o.discount);

  return (
    <>
      <Link href="/admin/stall" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink print:hidden">
        <ChevronLeft className="size-4" /> Stall orders
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <p className="hidden w-full text-lg font-semibold print:block">PocketGizmo</p>
        <h1 className="text-2xl font-semibold">{o.order_number}</h1>
        <CopyButton value={o.order_number} label="Copy order number" className="print:hidden" />
        <Badge color={STALL_STATUS_COLOR[o.status]}>{STALL_STATUS_LABEL[o.status]}</Badge>
        {o.status !== "cancelled" && <Badge color={due > 0 ? "warning" : "success"}>{due > 0 ? `${formatBDT(due)} to pay` : "Paid in full"}</Badge>}
        <span className="text-sm text-ink-soft">{formatDate(o.created_at)}</span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px] print:block">
        <div className="grid h-fit gap-6">
          <Card className="p-0">
            <h2 className="border-b border-line px-5 py-3 font-semibold">Items</h2>
            <ul className="divide-y divide-line">
              {o.stall_order_items.map((it) => (
                <li key={it.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-5 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium break-words">{it.name}</p>
                    {it.details && <p className="mt-1 inline-block rounded-md bg-warning/10 px-2 py-1 font-medium break-words">{it.details}</p>}
                  </div>
                  <span className="text-ink-soft tabular-nums">
                    {formatBDT(it.unit_price)} × {it.quantity}
                  </span>
                  <span className="w-20 text-right font-medium tabular-nums">{formatBDT(it.line_total)}</span>
                </li>
              ))}
            </ul>
            <dl className="grid gap-2 border-t border-line px-5 py-4 text-sm">
              <Row label="Items" value={formatBDT(o.subtotal)} />
              {Number(o.discount) > 0 && <Row label="Discount" value={`−${formatBDT(o.discount)}`} />}
              {Number(o.delivery_charge) > 0 && <Row label="Delivery" value={formatBDT(o.delivery_charge)} />}
              <Row label="Total" value={formatBDT(total)} strong />
              <Row label={`Paid${o.payment_method ? ` (${o.payment_method})` : ""}`} value={formatBDT(paid)} />
              <Row label="Still to pay" value={formatBDT(due)} strong danger={due > 0 && o.status !== "cancelled"} />
            </dl>
          </Card>

          <StallOrderActions order={{ id: o.id, status: o.status, total, paid }} />

          <p className="hidden text-sm print:block">
            Track this order at {SITE || "our website"}/track with the order number {o.order_number} and your mobile number. Thank you!
          </p>
        </div>

        <div className="grid h-fit gap-6 print:mt-6">
          <Card className="text-sm">
            <h2 className="font-semibold">Customer</h2>
            <p className="mt-2">{o.customer_name}</p>
            <p className="flex flex-wrap items-center gap-x-2">
              <a href={`tel:${o.customer_phone}`} className="text-accent hover:underline">
                {o.customer_phone}
              </a>
              <CopyButton value={o.customer_phone} label="Copy phone number" className="print:hidden" />
              <a
                href={`https://wa.me/88${normalizePhone(o.customer_phone)}?text=${encodeURIComponent(`Hello ${o.customer_name}, this is PocketGizmo about your order ${o.order_number}.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink-soft underline-offset-4 hover:text-ink hover:underline print:hidden"
              >
                WhatsApp
              </a>
            </p>

            <h2 className="mt-5 font-semibold">Handing over</h2>
            <p className="mt-2">{FULFILMENT_LABEL[o.fulfilment]}</p>
            {o.fulfilment === "pickup" && <p className="font-medium">Pickup point: {STALL_PICKUP_POINT}</p>}
            {o.delivery_address && <p className="text-ink-soft whitespace-pre-line">{o.delivery_address}</p>}
            {o.due_date && <p className="mt-1">Promised for {formatDay(o.due_date)}</p>}
            {o.delivered_at && <p className="mt-1 text-success">Delivered {formatDate(o.delivered_at)}</p>}

            <h2 className="mt-5 font-semibold">Stall</h2>
            <p className="mt-2 text-ink-soft">
              {o.stall_location || "No location entered"} · {formatDay(o.event_date)}
            </p>
            {o.note && (
              <>
                <h2 className="mt-5 font-semibold">Note</h2>
                <p className="mt-2 rounded-md bg-surface p-3 text-ink-soft whitespace-pre-line">{o.note}</p>
              </>
            )}
          </Card>

          {o.status !== "cancelled" && (
            <Card className="text-sm print:hidden">
              <h2 className="font-semibold">Profit</h2>
              {liveJobs.length === 0 ? (
                <p className="mt-2 text-ink-soft">This order is not on the supplier&apos;s print list, so there is no print cost to count.</p>
              ) : (
                <>
                  <dl className="mt-3 grid gap-2">
                    <Row label="Items sold (after discount)" value={formatBDT(itemSales)} />
                    <Row label="Print cost" value={`−${formatBDT(printCost)}`} />
                    <Row label={jobsWithoutCost ? "Profit so far" : "Profit"} value={formatBDT(itemSales - printCost)} strong danger={itemSales - printCost < 0} />
                  </dl>
                  {jobsWithoutCost > 0 && (
                    <p className="mt-3 rounded-md bg-warning/10 px-3 py-2 text-xs">
                      {jobsWithoutCost} print job{jobsWithoutCost === 1 ? " has" : "s have"} no cost yet, so the real profit is lower.
                    </p>
                  )}
                  <Link href={`/admin/supplier?tab=all&q=${o.order_number}`} className="mt-3 inline-block font-medium underline underline-offset-4">
                    See the print jobs
                  </Link>
                </>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label, value, strong, danger }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", strong && "border-t border-line pt-2 text-base font-semibold")}>
      <dt className={strong ? "" : "text-ink-soft"}>{label}</dt>
      <dd className={cn("tabular-nums", danger && "text-danger")}>{value}</dd>
    </div>
  );
}
