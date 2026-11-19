import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, PageTitle } from "@/components/ui";
import { PrintButton } from "@/components/admin/print-button";
import { MONTH_RE, getMonthlyReport, monthLabel, shiftMonth, thisMonth } from "@/lib/reports";
import { PAYMENT_LABEL, formatBDT } from "@/lib/utils";

export const metadata: Metadata = { title: "Monthly report" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const current = thisMonth();
  const month = sp.month && MONTH_RE.test(sp.month) && sp.month <= current ? sp.month : current;
  const supabase = await createClient();
  const r = await getMonthlyReport(supabase, month);
  const t = r.sales.totals;
  const stall = r.stall?.totals;
  const profit = r.profit;
  const net = Number(profit?.profit ?? 0) + Number(stall?.revenue ?? 0) - Number(r.stall?.print_cost ?? 0);
  const maxDay = Math.max(1, ...r.sales.daily.map((d) => Number(d.revenue)));

  return (
    <div className="grid gap-6">
      <PageTitle
        action={
          <div className="flex flex-wrap gap-2 print:hidden">
            <a href={`/admin/reports/export?month=${month}&kind=orders`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-medium ring-1 ring-line hover:ring-ink/30">
              <Download className="size-4" /> Orders (Excel)
            </a>
            <a href={`/admin/reports/export?month=${month}&kind=summary`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-medium ring-1 ring-line hover:ring-ink/30">
              <Download className="size-4" /> Summary (Excel)
            </a>
            <PrintButton />
          </div>
        }
      >
        Report for {monthLabel(month)}
      </PageTitle>

      <nav className="flex items-center gap-2 text-sm print:hidden" aria-label="Month">
        <Link href={`/admin/reports?month=${shiftMonth(month, -1)}`} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-ink-soft hover:bg-white hover:text-ink">
          <ChevronLeft className="size-4" /> {monthLabel(shiftMonth(month, -1))}
        </Link>
        {month < current && (
          <Link href={`/admin/reports?month=${shiftMonth(month, 1)}`} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-ink-soft hover:bg-white hover:text-ink">
            {monthLabel(shiftMonth(month, 1))} <ChevronRight className="size-4" />
          </Link>
        )}
      </nav>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Online sales" value={formatBDT(t.revenue)} note={`${t.orders} orders · avg ${formatBDT(t.aov)}`} />
        <Stat label="Stall sales" value={formatBDT(stall?.revenue ?? 0)} note={`${stall?.orders ?? 0} orders · ${formatBDT(stall?.due ?? 0)} still due`} />
        <Stat
          label="Profit (online + stall)"
          value={formatBDT(net)}
          note={profit?.uncounted_orders ? `${profit.uncounted_orders} online order(s) have no print cost yet` : "After print costs, before delivery"}
        />
        <Stat label="Paid to supplier" value={formatBDT(r.supplierPaid)} note={`${r.supplierJobs} print jobs settled`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="text-sm">
          <h2 className="font-semibold">Money in and out (online)</h2>
          <dl className="mt-4 grid gap-2">
            <Row label="Items sold (before discounts)" value={formatBDT(r.orders.filter((o) => o.status !== "cancelled").reduce((n, o) => n + Number(o.subtotal), 0))} />
            <Row label="Deal discounts" value={`−${formatBDT(r.discounts.deals)}`} />
            <Row label="Coupon discounts" value={`−${formatBDT(r.discounts.coupons)}`} />
            <Row label="Paid with points" value={`−${formatBDT(r.discounts.points)}`} />
            <Row label="Gift wrap charges" value={formatBDT(r.giftFees)} />
            <Row label="Delivery charges (to courier)" value={formatBDT(r.shipping)} />
            <Row label="Print cost of these orders" value={`−${formatBDT(profit?.cost ?? 0)}`} />
            <div className="flex justify-between border-t border-line pt-2 font-semibold">
              <dt>Online profit</dt>
              <dd className="tabular-nums">{formatBDT(profit?.profit ?? 0)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-ink-soft">
            {r.sales.cancelled} cancelled order{r.sales.cancelled === 1 ? "" : "s"} not counted. Points this month: {r.points.earned} earned, {r.points.used} used.
          </p>
        </Card>

        <Card className="text-sm">
          <h2 className="font-semibold">By payment method</h2>
          <table className="mt-3 w-full">
            <tbody className="divide-y divide-line">
              {r.sales.by_payment.map((p) => (
                <tr key={p.method}>
                  <td className="py-2">{PAYMENT_LABEL[p.method as keyof typeof PAYMENT_LABEL] ?? p.method}</td>
                  <td className="py-2 text-right text-ink-soft tabular-nums">{p.orders} orders</td>
                  <td className="py-2 text-right font-medium tabular-nums">{formatBDT(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!r.sales.by_payment.length && <p className="mt-3 text-ink-soft">No sales this month.</p>}

          <h2 className="mt-6 font-semibold">Best sellers</h2>
          <table className="mt-3 w-full">
            <tbody className="divide-y divide-line">
              {r.sales.top_products.slice(0, 8).map((p) => (
                <tr key={p.name}>
                  <td className="py-2 pr-3">{p.name}</td>
                  <td className="py-2 text-right text-ink-soft tabular-nums">× {p.quantity}</td>
                  <td className="py-2 text-right font-medium tabular-nums">{formatBDT(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card className="p-0 text-sm">
        <h2 className="border-b border-line px-5 py-3 font-semibold">Day by day</h2>
        <table className="w-full">
          <thead className="text-xs text-ink-soft">
            <tr>
              <th className="px-5 py-2 text-left font-medium">Day</th>
              <th className="px-5 py-2 text-right font-medium">Orders</th>
              <th className="px-5 py-2 text-right font-medium">Sales</th>
              <th className="hidden w-1/3 px-5 py-2 sm:table-cell"><span className="sr-only">Bar</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {r.sales.daily.filter((d) => Number(d.orders) > 0).map((d) => (
              <tr key={d.day}>
                <td className="px-5 py-1.5">{new Date(`${d.day}T12:00:00+06:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</td>
                <td className="px-5 py-1.5 text-right tabular-nums">{d.orders}</td>
                <td className="px-5 py-1.5 text-right font-medium tabular-nums">{formatBDT(d.revenue)}</td>
                <td className="hidden px-5 py-1.5 sm:table-cell">
                  <span className="block h-2 rounded-r-full bg-accent" style={{ width: `${(Number(d.revenue) / maxDay) * 100}%` }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!r.sales.daily.some((d) => Number(d.orders) > 0) && <p className="px-5 py-4 text-ink-soft">No orders this month.</p>}
      </Card>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card>
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-ink-soft">{note}</p>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
