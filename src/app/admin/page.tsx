import { CountUp } from "@/components/motion";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CreditCard, PenTool } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, Input, PageTitle, Button } from "@/components/ui";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { PAYMENT_LABEL, STATUS_LABEL, cn, formatBDT, variantLabel, type OrderStatus } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

type Summary = {
  totals: { revenue: number; orders: number; aov: number; discounts: number; items: number };
  cancelled: number;
  daily: { day: string; revenue: number; orders: number }[];
  by_payment: { method: string; revenue: number; orders: number }[];
  by_status: { status: OrderStatus; orders: number }[];
  top_products: { name: string; quantity: number; revenue: number }[];
  pending_verification: number;
  low_stock: { variant_id: string; product: string; options: Record<string, string>; stock: number }[];
};

const RANGES = [
  { key: "today", label: "Today", days: 1 },
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
] as const;

/** Calendar date in Dhaka as YYYY-MM-DD. */
const dhakaDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
const startOfDhakaDay = (ymd: string) => new Date(`${ymd}T00:00:00+06:00`);

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const sp = await searchParams;
  const today = dhakaDate(new Date());
  const custom = sp.from && sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) && /^\d{4}-\d{2}-\d{2}$/.test(sp.to);
  const range = custom ? null : (RANGES.find((r) => r.key === sp.range) ?? RANGES[2]);
  const fromYmd = custom ? sp.from! : dhakaDate(new Date(Date.now() - (range!.days - 1) * 86400000));
  const toYmd = custom ? sp.to! : today;
  const from = startOfDhakaDay(fromYmd);
  const to = new Date(startOfDhakaDay(toYmd).getTime() + 86400000 - 1);

  const supabase = await createClient();
  const [{ data, error }, { count: newRequests }] = await Promise.all([
    supabase.rpc("sales_summary", { p_from: from.toISOString(), p_to: to.toISOString() }),
    supabase.from("custom_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);
  if (error || !data) return <p className="text-danger">Couldn&apos;t load the dashboard: {error?.message}</p>;
  const s = data as unknown as Summary;
  const t = s.totals;

  const paymentTotal = s.by_payment.reduce((n, p) => n + Number(p.revenue), 0);
  const maxTop = Math.max(1, ...s.top_products.map((p) => Number(p.revenue)));

  return (
    <>
      <PageTitle>Dashboard</PageTitle>

      {/* Range filter */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <nav className="flex rounded-lg bg-white p-1 shadow-xs ring-1 ring-line" aria-label="Date range">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/admin?range=${r.key}`}
              aria-current={range?.key === r.key ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium",
                range?.key === r.key ? "bg-ink text-white" : "text-ink-soft hover:text-ink",
              )}
            >
              {r.label}
            </Link>
          ))}
        </nav>
        <form className="flex items-center gap-2 text-sm">
          <Input type="date" name="from" defaultValue={fromYmd} max={today} className="h-9 w-auto" aria-label="From date" />
          <span className="text-ink-soft">to</span>
          <Input type="date" name="to" defaultValue={toYmd} max={today} className="h-9 w-auto" aria-label="To date" />
          <Button variant="secondary" size="sm" type="submit" className="h-9">Apply</Button>
        </form>
      </div>

      {/* Action items */}
      {(s.pending_verification > 0 || !!newRequests || s.low_stock.length > 0) && (
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          {s.pending_verification > 0 && (
            <ActionItem href="/admin/orders?tab=verify" icon={CreditCard} text={`${s.pending_verification} payment${s.pending_verification > 1 ? "s" : ""} to verify`} />
          )}
          {!!newRequests && <ActionItem href="/admin/custom-requests?tab=new" icon={PenTool} text={`${newRequests} new custom request${newRequests > 1 ? "s" : ""}`} />}
          {s.low_stock.length > 0 && (
            <ActionItem href="/admin/inventory?low=1" icon={AlertTriangle} text={`${s.low_stock.length} variant${s.low_stock.length > 1 ? "s" : ""} low on stock`} />
          )}
        </div>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Revenue" value={<CountUp value={Number(t.revenue)} format="bdt" />} sub={Number(t.discounts) > 0 ? `${formatBDT(t.discounts)} in discounts` : undefined} />
        <Stat label="Orders" value={<CountUp value={Number(t.orders)} />} sub={s.cancelled ? `${s.cancelled} cancelled` : undefined} />
        <Stat label="Average order" value={<CountUp value={Number(t.aov)} format="bdt" />} />
        <Stat label="Items sold" value={<CountUp value={Number(t.items)} />} />
      </div>

      {/* Revenue over time */}
      <Card className="mt-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-semibold">Revenue by day</h2>
          <p className="text-xs text-ink-soft">Excludes cancelled orders</p>
        </div>
        <RevenueChart data={s.daily.map((d) => ({ ...d, revenue: Number(d.revenue) }))} from={fromYmd} to={toYmd} />
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {/* Top products */}
        <Card className="xl:col-span-2">
          <h2 className="mb-4 font-semibold">Top products</h2>
          {s.top_products.length ? (
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-soft">
                <tr>
                  <th className="pb-2 text-left font-medium">Product</th>
                  <th className="w-20 pb-2 text-right font-medium">Sold</th>
                  <th className="w-56 pb-2 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {s.top_products.map((p) => (
                  <tr key={p.name}>
                    <td className="py-2.5">{p.name}</td>
                    <td className="py-2.5 text-right tabular-nums">{p.quantity}</td>
                    <td className="py-2.5">
                      <div className="flex items-center justify-end gap-3">
                        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                          <div className="h-full rounded-full bg-accent" style={{ width: `${(Number(p.revenue) / maxTop) * 100}%` }} />
                        </div>
                        <span className="w-20 text-right tabular-nums">{formatBDT(p.revenue)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty />
          )}
        </Card>

        {/* Payment methods */}
        <Card>
          <h2 className="mb-4 font-semibold">Payment methods</h2>
          {s.by_payment.length ? (
            <ul className="grid gap-4">
              {[...s.by_payment].sort((a, b) => Number(b.revenue) - Number(a.revenue)).map((p) => {
                const pct = paymentTotal ? (Number(p.revenue) / paymentTotal) * 100 : 0;
                return (
                  <li key={p.method} className="text-sm">
                    <div className="flex justify-between">
                      <span>{PAYMENT_LABEL[p.method]}</span>
                      <span className="tabular-nums">
                        {formatBDT(p.revenue)} <span className="text-ink-soft">· {Math.round(pct)}%</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                      <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">{p.orders} order{p.orders === 1 ? "" : "s"}</p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty />
          )}
        </Card>

        {/* Orders by status */}
        <Card>
          <h2 className="mb-4 font-semibold">Orders by status</h2>
          {s.by_status.length ? (
            <ul className="divide-y divide-line text-sm">
              {s.by_status.map((b) => (
                <li key={b.status}>
                  <Link href={`/admin/orders?tab=${b.status}`} className="flex justify-between py-2 hover:text-accent">
                    <span>{STATUS_LABEL[b.status]}</span>
                    <span className="tabular-nums">{b.orders}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty />
          )}
        </Card>

        {/* Low stock */}
        <Card className="xl:col-span-2">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-semibold">Low stock</h2>
            <Link href="/admin/inventory?low=1" className="text-sm text-ink-soft hover:text-ink">Manage inventory →</Link>
          </div>
          {s.low_stock.length ? (
            <ul className="divide-y divide-line text-sm">
              {s.low_stock.slice(0, 8).map((v) => (
                <li key={v.variant_id} className="flex justify-between py-2">
                  <span>
                    {v.product} <span className="text-ink-soft">{variantLabel(v.options)}</span>
                  </span>
                  <span className={cn("font-medium tabular-nums", v.stock === 0 ? "text-danger" : "text-warning")}>
                    {v.stock === 0 ? "Out of stock" : `${v.stock} left`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">Everything is well stocked.</p>
          )}
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card>
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-soft">{sub}</p>}
    </Card>
  );
}

function ActionItem({ href, icon: Icon, text }: { href: string; icon: React.ElementType; text: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-xl border border-warning/25 bg-warning/5 px-4 py-3 text-sm font-medium">
      <Icon className="size-4 text-warning" />
      <span className="flex-1">{text}</span>
      <ArrowRight className="size-4 text-ink-soft transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function Empty() {
  return <p className="text-sm text-ink-soft">No sales in this period.</p>;
}
