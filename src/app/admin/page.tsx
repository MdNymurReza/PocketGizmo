import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleCheck,
  CreditCard,
  Inbox,
  PenTool,
  Plus,
  Star,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { getSessionProfile } from "@/lib/supabase/server";
import { Badge, Button, ButtonLink, Card, Input } from "@/components/ui";
import { CountUp } from "@/components/motion";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { ADVANCE_STATUS_COLOR, ADVANCE_STATUS_LABEL, ORDER_STATUS_COLOR, PAYMENT_STATUS_COLOR, PAYMENT_STATUS_LABEL } from "@/lib/orders";
import { PAYMENT_LABEL, STATUS_LABEL, cn, formatBDT, formatDate, variantLabel, type OrderStatus } from "@/lib/utils";

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

/** Open orders move left to right through these stages. */
const PIPELINE = [
  { status: "pending", label: "To confirm", hint: "New orders waiting for you" },
  { status: "confirmed", label: "To print", hint: "Confirmed, not started" },
  { status: "printing", label: "Printing", hint: "Being made now" },
  { status: "shipped", label: "On the way", hint: "With the courier" },
] as const;

/** Calendar date in Dhaka as YYYY-MM-DD. */
const dhakaDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
const startOfDhakaDay = (ymd: string) => new Date(`${ymd}T00:00:00+06:00`);
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const PLACEHOLDER = /X{4,}/i;

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const sp = await searchParams;
  const now = new Date();
  const today = dhakaDate(now);
  const custom = Boolean(sp.from && sp.to && YMD.test(sp.from) && YMD.test(sp.to) && sp.from <= sp.to);
  const range = custom ? null : (RANGES.find((r) => r.key === sp.range) ?? RANGES[2]);
  const fromYmd = custom ? sp.from! : dhakaDate(new Date(now.getTime() - (range!.days - 1) * 86400000));
  const toYmd = custom ? sp.to! : today;
  const from = startOfDhakaDay(fromYmd);
  const to = new Date(startOfDhakaDay(toYmd).getTime() + 86400000 - 1);
  // The same number of days immediately before, for the "vs previous period" comparison.
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(from.getTime() - (to.getTime() - from.getTime() + 1));

  const { supabase, profile } = await getSessionProfile();
  const openCount = (status: OrderStatus) => supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", status);

  const [{ data, error }, { data: prevData }, { count: newRequests }, { count: newReviews }, { data: recent }, { count: products }, { data: settings }, { data: profit }, { data: stall }, { count: stallOpen }, ...pipelineCounts] =
    await Promise.all([
      supabase.rpc("sales_summary", { p_from: from.toISOString(), p_to: to.toISOString() }),
      supabase.rpc("sales_summary", { p_from: prevFrom.toISOString(), p_to: prevTo.toISOString() }),
      supabase.from("custom_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
      supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase
        .from("orders")
        .select("id, order_number, customer_name, total, status, payment_method, payment_status, advance_status, created_at")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("settings").select("bkash_number, nagad_number, rocket_number, contact_phone, contact_email").eq("id", 1).single(),
      supabase.rpc("admin_profit_summary", { p_from: from.toISOString(), p_to: to.toISOString() }),
      // Orders taken by hand at the stall, for the same days.
      supabase.rpc("stall_summary", { p_from: fromYmd, p_to: toYmd }),
      supabase.from("stall_orders").select("id", { count: "exact", head: true }).in("status", ["new", "printing", "ready"]),
      ...PIPELINE.map((p) => openCount(p.status)),
    ]);
  if (error || !data) return <p className="text-danger">Couldn&apos;t load the dashboard: {error?.message}</p>;
  const s = data as unknown as Summary;
  const t = s.totals;
  const prev = (prevData as unknown as Summary | null)?.totals ?? null;

  const pipeline = PIPELINE.map((p, i) => ({ ...p, count: pipelineCounts[i]?.count ?? 0 }));
  const toConfirm = pipeline[0].count;
  const paymentTotal = s.by_payment.reduce((n, p) => n + Number(p.revenue), 0);
  const maxTop = Math.max(1, ...s.top_products.map((p) => Number(p.revenue)));
  const outOfStock = s.low_stock.filter((v) => v.stock === 0).length;

  // First-time setup: shown until every step is done.
  const hasWallet = [settings?.bkash_number, settings?.nagad_number, settings?.rocket_number].some((n) => n && !PLACEHOLDER.test(n));
  const setup = [
    { done: (products ?? 0) > 0, label: "Add your first product", hint: "With photos, colors and stock.", href: "/admin/products/new" },
    { done: hasWallet, label: "Set your bKash, Nagad or Rocket number", hint: "Customers send payments to these.", href: "/admin/settings" },
    {
      done: Boolean(settings?.contact_phone || settings?.contact_email),
      label: "Add your contact details",
      hint: "Shown in the footer and policy pages.",
      href: "/admin/settings",
    },
  ];
  const setupLeft = setup.filter((x) => !x.done).length;

  const attention = [
    s.pending_verification > 0 && {
      href: "/admin/orders?tab=verify",
      icon: CreditCard,
      count: s.pending_verification,
      text: `payment${s.pending_verification > 1 ? "s" : ""} to verify`,
    },
    toConfirm > 0 && { href: "/admin/orders?tab=pending", icon: Inbox, count: toConfirm, text: `new order${toConfirm > 1 ? "s" : ""} to confirm` },
    !!stallOpen && { href: "/admin/stall?tab=open", icon: Inbox, count: stallOpen, text: `stall order${stallOpen > 1 ? "s" : ""} to hand over` },
    !!newRequests && { href: "/admin/custom-requests?tab=new", icon: PenTool, count: newRequests, text: `custom request${newRequests > 1 ? "s" : ""} to quote` },
    !!newReviews && { href: "/admin/reviews", icon: Star, count: newReviews, text: `review${newReviews > 1 ? "s" : ""} to approve` },
    s.low_stock.length > 0 && {
      href: "/admin/inventory?low=1",
      icon: AlertTriangle,
      count: s.low_stock.length,
      text: `variant${s.low_stock.length > 1 ? "s" : ""} low on stock${outOfStock ? ` (${outOfStock} sold out)` : ""}`,
    },
  ].filter(Boolean) as { href: string; icon: React.ElementType; count: number; text: string }[];

  const hour = Number(now.toLocaleString("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", hour12: false }));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = profile?.full_name?.trim().split(/\s+/)[0];
  const periodLabel = custom ? "period" : range!.key === "today" ? "day" : range!.label;

  return (
    <div className="grid gap-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-soft">
            {now.toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/admin/orders" variant="secondary" size="sm">
            View orders
          </ButtonLink>
          <ButtonLink href="/admin/products/new" size="sm">
            <Plus className="size-4" /> Add product
          </ButtonLink>
        </div>
      </div>

      {/* First-time setup */}
      {setupLeft > 0 && (
        <Card>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">Finish setting up your store</h2>
            <p className="text-sm text-ink-soft">
              {setup.length - setupLeft} of {setup.length} done
            </p>
          </div>
          <ul className="mt-4 grid gap-2 md:grid-cols-3">
            {setup.map((step) => (
              <li key={step.label}>
                <Link
                  href={step.href}
                  className={cn(
                    "flex h-full gap-3 rounded-lg border p-3 text-sm transition-colors",
                    step.done ? "border-line bg-surface text-ink-soft" : "border-line hover:border-ink/25",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
                      step.done ? "bg-success text-white" : "border border-ink/25",
                    )}
                  >
                    {step.done && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span>
                    <span className={cn("block font-medium", step.done && "line-through")}>{step.label}</span>
                    <span className="block text-xs text-ink-soft">{step.done ? "Done" : step.hint}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Today: what needs doing */}
      <section aria-labelledby="today-heading" className="grid gap-4">
        <h2 id="today-heading" className="text-sm font-semibold tracking-wide text-ink-soft uppercase">
          To do
        </h2>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {pipeline.map((p) => (
            <Link
              key={p.status}
              href={`/admin/orders?tab=${p.status}`}
              className="group rounded-xl border border-line bg-white p-4 shadow-xs transition-colors hover:border-ink/25"
            >
              <p className="flex items-center justify-between text-sm font-medium">
                {p.label}
                <ArrowRight className="size-4 text-ink-soft opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
              </p>
              <p className={cn("mt-2 text-3xl font-semibold tabular-nums", p.count === 0 && "text-ink-soft/50")}>{p.count}</p>
              <p className="mt-0.5 truncate text-xs text-ink-soft">{p.hint}</p>
            </Link>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="p-0">
            <h3 className="border-b border-line px-5 py-3.5 font-semibold">Needs attention</h3>
            {attention.length ? (
              <ul className="divide-y divide-line">
                {attention.map(({ href, icon: Icon, count, text }) => (
                  <li key={href}>
                    <Link href={href} className="group flex items-center gap-3 px-5 py-3.5 text-sm transition-colors hover:bg-surface">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-warning/10 text-warning">
                        <Icon className="size-4" />
                      </span>
                      <span className="flex-1">
                        <span className="font-semibold tabular-nums">{count}</span> {text}
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-ink-soft transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-3 px-5 py-6 text-sm">
                <CircleCheck className="size-5 shrink-0 text-success" />
                <p>
                  <span className="font-medium">You&apos;re all caught up.</span>{" "}
                  <span className="text-ink-soft">Nothing is waiting on you.</span>
                </p>
              </div>
            )}
          </Card>

          <Card className="overflow-hidden p-0 xl:col-span-2">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h3 className="font-semibold">Latest orders</h3>
              <Link href="/admin/orders" className="group inline-flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink">
                All orders <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            {recent?.length ? (
              <ul className="divide-y divide-line">
                {recent.map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-surface">
                      <div className="min-w-0 flex-1">
                        <p className="truncate">
                          <span className="font-medium">{o.order_number}</span> <span className="text-ink-soft">· {o.customer_name}</span>
                        </p>
                        <p className="truncate text-xs text-ink-soft">
                          {formatDate(o.created_at)} · {PAYMENT_LABEL[o.payment_method]}
                        </p>
                      </div>
                      <div className="hidden shrink-0 sm:block">
                        {o.advance_status === "pending" ? (
                          <Badge color={ADVANCE_STATUS_COLOR.pending}>{ADVANCE_STATUS_LABEL.pending}</Badge>
                        ) : o.payment_status === "pending_verification" ? (
                          <Badge color={PAYMENT_STATUS_COLOR[o.payment_status]}>{PAYMENT_STATUS_LABEL[o.payment_status]}</Badge>
                        ) : null}
                      </div>
                      <Badge color={ORDER_STATUS_COLOR[o.status]} className="shrink-0">
                        {STATUS_LABEL[o.status]}
                      </Badge>
                      <span className="w-20 shrink-0 text-right font-medium tabular-nums">{formatBDT(o.total)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-ink-soft">No orders yet. They&apos;ll appear here as soon as customers start buying.</p>
            )}
          </Card>
        </div>
      </section>

      {/* Sales for the chosen period */}
      <section aria-labelledby="sales-heading" className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="sales-heading" className="text-sm font-semibold tracking-wide text-ink-soft uppercase">
            Sales
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <nav className="flex rounded-lg bg-white p-1 shadow-xs ring-1 ring-line" aria-label="Date range">
              {RANGES.map((r) => (
                <Link
                  key={r.key}
                  href={`/admin?range=${r.key}`}
                  scroll={false}
                  aria-current={range?.key === r.key ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
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
              <Button variant="secondary" size="sm" type="submit" className="h-9">
                Apply
              </Button>
            </form>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Revenue"
            value={<CountUp value={Number(t.revenue)} format="bdt" />}
            trend={<Trend now={Number(t.revenue)} prev={prev && Number(prev.revenue)} period={periodLabel} />}
            sub={Number(t.discounts) > 0 ? `${formatBDT(t.discounts)} given in discounts` : undefined}
          />
          <Stat
            label="Orders"
            value={<CountUp value={Number(t.orders)} />}
            trend={<Trend now={Number(t.orders)} prev={prev && Number(prev.orders)} period={periodLabel} />}
            sub={s.cancelled ? `${s.cancelled} cancelled (not counted)` : undefined}
          />
          <Stat
            label="Average order"
            value={<CountUp value={Number(t.aov)} format="bdt" />}
            trend={<Trend now={Number(t.aov)} prev={prev && Number(prev.aov)} period={periodLabel} />}
          />
          <Stat
            label="Items sold"
            value={<CountUp value={Number(t.items)} />}
            trend={<Trend now={Number(t.items)} prev={prev && Number(prev.items)} period={periodLabel} />}
          />
        </div>

        {stall && (
          <Card>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold">Website and stall together</h3>
              <Link href="/admin/stall" className="text-sm font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline">
                Open stall orders
              </Link>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 text-sm lg:grid-cols-4">
              <div>
                <dt className="text-ink-soft">Website revenue</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{formatBDT(t.revenue)}</dd>
                <dd className="text-xs text-ink-soft">{t.orders} order{Number(t.orders) === 1 ? "" : "s"}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">Stall revenue</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{formatBDT(stall.totals.revenue)}</dd>
                <dd className="text-xs text-ink-soft">{stall.totals.orders} order{Number(stall.totals.orders) === 1 ? "" : "s"}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">Total revenue</dt>
                <dd className="mt-0.5 text-lg font-semibold text-accent tabular-nums">{formatBDT(Number(t.revenue) + Number(stall.totals.revenue))}</dd>
                <dd className="text-xs text-ink-soft">{Number(t.orders) + Number(stall.totals.orders)} orders in all</dd>
              </div>
              <div>
                <dt className="text-ink-soft">Stall money still to collect</dt>
                <dd className={cn("mt-0.5 text-lg font-semibold tabular-nums", Number(stall.totals.due) > 0 && "text-danger")}>{formatBDT(stall.totals.due)}</dd>
                <dd className="text-xs text-ink-soft">{formatBDT(stall.totals.collected)} collected</dd>
              </div>
            </dl>
            {Number(stall.totals.orders) > 0 && (
              <p className="mt-4 border-t border-line pt-3 text-sm text-ink-soft">
                Stall after print cost: <span className="font-medium text-ink tabular-nums">{formatBDT(Number(stall.totals.revenue) - Number(stall.print_cost))}</span> (
                {formatBDT(stall.print_cost)} print cost entered so far). The four numbers at the top and the chart below count website orders only.
              </p>
            )}
          </Card>
        )}

        {profit && (
          <Card className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
            <div>
              <p className="text-sm text-ink-soft">Website profit after print costs</p>
              <p className={cn("mt-1 text-2xl font-semibold tabular-nums", Number(profit.profit) < 0 && "text-danger")}>
                {Number(profit.counted_orders) > 0 ? formatBDT(profit.profit) : "–"}
              </p>
            </div>
            <div className="max-w-xl text-sm text-ink-soft">
              {Number(profit.counted_orders) > 0 ? (
                <p>
                  Items sold for {formatBDT(profit.sales)}, minus {formatBDT(profit.cost)} print cost, from {profit.counted_orders} order
                  {Number(profit.counted_orders) === 1 ? "" : "s"}. Delivery charges are not counted.
                </p>
              ) : (
                <p>No order in this period has its print costs yet.</p>
              )}
              {Number(profit.uncounted_orders) > 0 && (
                <p className="mt-1">
                  {profit.uncounted_orders} order{Number(profit.uncounted_orders) === 1 ? " is" : "s are"} not counted, because the print cost is missing.{" "}
                  <Link href="/admin/supplier?tab=all" className="font-medium text-ink underline underline-offset-4">
                    Open the print list
                  </Link>
                </p>
              )}
            </div>
          </Card>
        )}

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <div className="mb-4 flex items-baseline justify-between">
              <h3 className="font-semibold">Revenue by day</h3>
              <p className="text-xs text-ink-soft">Excludes cancelled orders</p>
            </div>
            <RevenueChart data={s.daily.map((d) => ({ ...d, revenue: Number(d.revenue) }))} from={fromYmd} to={toYmd} />
          </Card>

          <Card>
            <h3 className="mb-4 font-semibold">Payment methods</h3>
            {s.by_payment.length ? (
              <ul className="grid gap-4">
                {[...s.by_payment]
                  .sort((a, b) => Number(b.revenue) - Number(a.revenue))
                  .map((p) => {
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
                        <p className="mt-1 text-xs text-ink-soft">
                          {p.orders} order{p.orders === 1 ? "" : "s"}
                        </p>
                      </li>
                    );
                  })}
              </ul>
            ) : (
              <Empty />
            )}
          </Card>

          <Card className="xl:col-span-2">
            <h3 className="mb-4 font-semibold">Top products</h3>
            {s.top_products.length ? (
              <table className="w-full text-sm">
                <thead className="text-xs text-ink-soft">
                  <tr>
                    <th className="pb-2 text-left font-medium">Product</th>
                    <th className="w-16 pb-2 text-right font-medium">Sold</th>
                    <th className="w-24 pb-2 text-right font-medium sm:w-56">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {s.top_products.map((p) => (
                    <tr key={p.name}>
                      <td className="py-2.5">{p.name}</td>
                      <td className="py-2.5 text-right tabular-nums">{p.quantity}</td>
                      <td className="py-2.5">
                        <div className="flex items-center justify-end gap-3">
                          <div className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-surface-2 sm:block" aria-hidden>
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

          <Card>
            <div className="mb-4 flex items-baseline justify-between">
              <h3 className="font-semibold">Low stock</h3>
              <Link href="/admin/inventory?low=1" className="text-sm text-ink-soft hover:text-ink">
                Manage
              </Link>
            </div>
            {s.low_stock.length ? (
              <ul className="divide-y divide-line text-sm">
                {s.low_stock.slice(0, 6).map((v) => (
                  <li key={v.variant_id} className="flex justify-between gap-3 py-2">
                    <span className="min-w-0 truncate">
                      {v.product} <span className="text-ink-soft">{variantLabel(v.options)}</span>
                    </span>
                    <span className={cn("shrink-0 font-medium tabular-nums", v.stock === 0 ? "text-danger" : "text-warning")}>
                      {v.stock === 0 ? "Sold out" : `${v.stock} left`}
                    </span>
                  </li>
                ))}
                {s.low_stock.length > 6 && <li className="pt-2 text-xs text-ink-soft">and {s.low_stock.length - 6} more</li>}
              </ul>
            ) : (
              <p className="text-sm text-ink-soft">Everything is well stocked.</p>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, trend, sub }: { label: string; value: React.ReactNode; trend?: React.ReactNode; sub?: string }) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <div className="mt-1.5 min-h-4">{trend}</div>
      {sub && <p className="mt-1 text-xs text-ink-soft">{sub}</p>}
    </Card>
  );
}

/** Change against the previous period of the same length. */
function Trend({ now, prev, period }: { now: number; prev: number | null; period: string }) {
  if (prev === null || (!prev && !now)) return null;
  if (!prev) return <p className="text-xs text-ink-soft">Nothing in the previous {period}</p>;
  const pct = ((now - prev) / prev) * 100;
  const flat = Math.abs(pct) < 0.5;
  const up = pct > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <p className="flex flex-wrap items-center gap-x-1 text-xs">
      {flat ? (
        <span className="font-medium text-ink-soft">No change</span>
      ) : (
        <span className={cn("inline-flex items-center gap-1 font-medium", up ? "text-success" : "text-danger")}>
          <Icon className="size-3.5" />
          {up ? "Up" : "Down"} {Math.abs(pct) > 999 ? "999+" : Math.round(Math.abs(pct))}%
        </span>
      )}
      <span className="text-ink-soft">vs previous {period}</span>
    </p>
  );
}

function Empty() {
  return <p className="text-sm text-ink-soft">No sales in this period.</p>;
}
