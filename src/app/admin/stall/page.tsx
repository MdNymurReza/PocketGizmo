import type { Metadata } from "next";
import Link from "next/link";
import { LayoutGrid, Plus, Search, Store, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, ButtonLink, Card, EmptyState, Input, PageTitle } from "@/components/ui";
import { StallRowActions } from "@/components/admin/stall-row-actions";
import { STALL_STATUS_COLOR, STALL_STATUS_LABEL, type StallStatus } from "@/lib/stall";
import { cn, formatBDT, formatDay } from "@/lib/utils";

export const metadata: Metadata = { title: "Stall orders" };

const PAGE = 30;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

const TABS: { key: "" | "open" | StallStatus; label: string }[] = [
  { key: "", label: "All" },
  { key: "open", label: "Open" },
  { key: "new", label: "Order taken" },
  { key: "printing", label: "Printing" },
  { key: "ready", label: "Ready" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

type SP = { tab?: string; q?: string; day?: string; page?: string };

export default async function StallPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as (typeof TABS)[number]["key"]) : "";
  const day = sp.day && YMD.test(sp.day) ? sp.day : "";
  const q = sp.q ?? "";
  const term = q.trim().replace(/[%_,()]/g, " ").trim();
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const supabase = await createClient();

  let query = supabase
    .from("stall_orders")
    .select("id, order_number, event_date, customer_name, customer_phone, status, total, paid_amount, fulfilment, due_date, stall_order_items(name, quantity)", { count: "exact" })
    .order("created_at", { ascending: false });
  if (tab === "open") query = query.in("status", ["new", "printing", "ready"]);
  else if (tab) query = query.eq("status", tab);
  if (day) query = query.eq("event_date", day);
  if (term) query = query.or(`order_number.ilike.%${term}%,customer_phone.ilike.%${term}%,customer_name.ilike.%${term}%`);

  const [{ data: orders, count }, { data: s, error }, { data: allDays }] = await Promise.all([
    query.range((page - 1) * PAGE, page * PAGE - 1),
    // The numbers follow the chosen stall day; without one they cover every day.
    supabase.rpc("stall_summary", { p_from: day || null, p_to: day || null }),
    day ? supabase.rpc("stall_summary", { p_from: null, p_to: null }) : Promise.resolve({ data: null }),
  ]);
  if (error || !s) return <p className="text-danger">Couldn&apos;t load the stall orders: {error?.message}</p>;

  const t = s.totals;
  const days = (allDays ?? s).by_date;
  const maxDay = Math.max(1, ...days.map((d) => Number(d.revenue)));
  const counts: Record<string, number> = { ...s.by_status, open: Number(t.open) };
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const href = (p: Partial<SP>) => {
    const merged = { tab, q: term, day, ...p };
    const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v) as [string, string][]).toString();
    return `/admin/stall${qs ? `?${qs}` : ""}`;
  };
  const profit = Number(t.revenue) - Number(s.print_cost);

  return (
    <>
      <PageTitle
        action={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/stall/products" variant="secondary">
              <LayoutGrid className="size-4" /> Product list
            </ButtonLink>
            <ButtonLink href="/admin/stall/new" variant="secondary">
              <Plus className="size-4" /> New order
            </ButtonLink>
            <ButtonLink href="/stall" variant="accent">
              <Zap className="size-4" /> Open the stall app
            </ButtonLink>
          </div>
        }
      >
        Stall orders
      </PageTitle>
      <p className="-mt-3 mb-6 max-w-2xl text-sm text-ink-soft">
        Orders you take by hand at the stall. Each order gets its own number (ST-1001, ST-1002, …) that the customer can use on the Track order page. At the stall, use the stall app: it saves orders on the device at once, works without internet, and uploads them here when you press Sync.
      </p>

      {day && (
        <p className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-4 py-2.5 text-sm">
          Showing the stall of <span className="font-semibold">{formatDay(day)}</span> only.
          <Link href={href({ day: undefined, page: undefined })} className="font-medium underline underline-offset-4">
            Show all days
          </Link>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Tile label="Orders" value={String(t.orders)} sub={Number(t.cancelled) ? `${t.cancelled} cancelled (not counted)` : undefined} />
        <Tile label="Revenue" value={formatBDT(t.revenue)} />
        <Tile label="Money collected" value={formatBDT(t.collected)} />
        <Tile label="Still to collect" value={formatBDT(t.due)} strong={Number(t.due) > 0} />
        <Tile label="Open orders" value={String(t.open)} sub={`${t.delivered} delivered`} />
        <Tile label="After print cost" value={formatBDT(profit)} sub={`${formatBDT(s.print_cost)} print cost so far`} />
      </div>

      {days.length > 0 && (
        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          <Card className="overflow-x-auto p-0 xl:col-span-2">
            <h2 className="border-b border-line px-5 py-3 font-semibold">Stall days</h2>
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-surface text-xs text-ink-soft">
                <tr>
                  <th className="px-5 py-2 font-medium">Date</th>
                  <th className="px-5 py-2 font-medium">Location</th>
                  <th className="px-5 py-2 text-right font-medium">Orders</th>
                  <th className="px-5 py-2 text-right font-medium">Collected</th>
                  <th className="px-5 py-2 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {days.map((d) => (
                  <tr key={d.date} className={cn("hover:bg-surface", d.date === day && "bg-accent/5")}>
                    <td className="px-5 py-2.5 whitespace-nowrap">
                      <Link href={href({ day: d.date, page: undefined })} className="font-medium hover:text-accent">
                        {formatDay(d.date)}
                      </Link>
                    </td>
                    <td className="px-5 py-2.5 text-ink-soft">{d.location || "–"}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{d.orders}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{formatBDT(d.collected)}</td>
                    <td className="px-5 py-2.5 text-right">
                      <span className="font-medium tabular-nums">{formatBDT(d.revenue)}</span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                        <span className="block h-full rounded-full bg-accent" style={{ width: `${(Number(d.revenue) / maxDay) * 100}%` }} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card>
            <h2 className="font-semibold">Best sellers</h2>
            {s.top_items.length ? (
              <ol className="mt-3 grid gap-2.5 text-sm">
                {s.top_items.map((it) => (
                  <li key={it.name} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 break-words">
                      {it.name} <span className="text-ink-soft">× {it.quantity}</span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">{formatBDT(it.revenue)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-ink-soft">Nothing sold yet.</p>
            )}
          </Card>
        </div>
      )}

      <div className="mt-8 mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-1" aria-label="Filter stall orders">
          {TABS.map((tb) => (
            <Link
              key={tb.key}
              href={href({ tab: tb.key, page: undefined })}
              aria-current={tab === tb.key ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === tb.key ? "bg-white text-ink shadow-xs ring-1 ring-line" : "text-ink-soft hover:text-ink",
              )}
            >
              {tb.label}
              {tb.key !== "" && tb.key !== "delivered" && tb.key !== "cancelled" && !!counts[tb.key] && (
                <Badge color={tb.key === "ready" ? "info" : "neutral"}>{counts[tb.key]}</Badge>
              )}
            </Link>
          ))}
        </nav>
        <form className="relative w-full sm:w-72">
          {tab && <input type="hidden" name="tab" value={tab} />}
          {day && <input type="hidden" name="day" value={day} />}
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
          <Input name="q" defaultValue={q} placeholder="Order ID, phone or name" className="pl-9" aria-label="Search stall orders" />
        </form>
      </div>

      <Card className="overflow-x-auto p-0">
        {orders?.length ? (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs font-medium text-ink-soft">
              <tr>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Delivered?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((o) => {
                const due = Number(o.total) - Number(o.paid_amount);
                return (
                  <tr key={o.id} className="hover:bg-surface">
                    <td className="px-4 py-3">
                      <Link href={`/admin/stall/${o.id}`} className="font-medium hover:text-accent">
                        {o.order_number}
                      </Link>
                      <p className="text-xs text-ink-soft">{formatDay(o.event_date)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{o.customer_name}</p>
                      <p className="text-xs text-ink-soft">{o.customer_phone}</p>
                    </td>
                    <td className="max-w-64 px-4 py-3">
                      <p className="line-clamp-2 break-words">{o.stall_order_items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}</p>
                      <p className="text-xs text-ink-soft">
                        {o.fulfilment === "delivery" ? "Home delivery" : "Customer collects"}
                        {o.due_date && ` · by ${formatDay(o.due_date)}`}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={STALL_STATUS_COLOR[o.status]}>{STALL_STATUS_LABEL[o.status]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-medium tabular-nums">{formatBDT(o.total)}</p>
                      {o.status !== "cancelled" && (
                        <p className={cn("text-xs tabular-nums", due > 0 ? "text-danger" : "text-success")}>{due > 0 ? `${formatBDT(due)} to pay` : "Paid"}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StallRowActions id={o.id} status={o.status} due={Math.max(0, due)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState
            icon={Store}
            title={term ? `No orders match “${term}”` : "No stall orders here yet"}
            text={term ? "Check the order ID or phone number." : "Click “New order” to take the first one."}
            action={!term && <ButtonLink href="/admin/stall/new">New order</ButtonLink>}
          />
        )}
      </Card>

      {pages > 1 && (
        <nav className="mt-6 flex justify-center gap-1" aria-label="Pagination">
          {Array.from({ length: pages }, (_, i) => i + 1)
            .filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 2)
            .map((n) => (
              <Link
                key={n}
                href={href({ page: n === 1 ? undefined : String(n) })}
                className={cn("grid size-9 place-items-center rounded-md text-sm font-medium", n === page ? "bg-ink text-white" : "text-ink-soft hover:bg-white")}
              >
                {n}
              </Link>
            ))}
        </nav>
      )}
    </>
  );
}

function Tile({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-4", strong ? "border-accent/30 bg-accent/5" : "border-line bg-white")}>
      <p className="text-xs font-medium text-ink-soft">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums", strong && "text-accent")}>{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-soft">{sub}</p>}
    </div>
  );
}
