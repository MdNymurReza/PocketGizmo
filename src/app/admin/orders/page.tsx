import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, Input, PageTitle } from "@/components/ui";
import { SendToPrint } from "@/components/admin/send-to-print";
import {
  ADVANCE_STATUS_COLOR,
  ADVANCE_STATUS_LABEL,
  ORDER_STATUS_COLOR,
  PAYMENT_STATUS_COLOR,
  PAYMENT_STATUS_LABEL,
} from "@/lib/orders";
import { PAYMENT_LABEL, STATUS_LABEL, cn, formatBDT, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };

const PAGE = 25;

const TABS = [
  { key: "", label: "All" },
  { key: "verify", label: "Needs payment check" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "printing", label: "Printing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
] as const;

type SP = { tab?: string; q?: string; page?: string };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { tab = "", q = "", page: pageStr } = await searchParams;
  const page = Math.max(1, Number(pageStr) || 1);
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select(
      "id, order_number, customer_name, customer_phone, total, status, payment_method, payment_status, advance_status, created_at, order_items(quantity)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  // "Needs payment check" = a wallet payment or a COD delivery-charge advance awaiting verification.
  const NEEDS_CHECK = "payment_status.eq.pending_verification,advance_status.eq.pending";
  const term = q.trim().replace(/[%_,()]/g, "");
  const search = `order_number.ilike.%${term}%,customer_phone.ilike.%${term}%,customer_name.ilike.%${term}%,trx_id.ilike.%${term}%`;

  if (tab === "verify") {
    query = query.neq("status", "cancelled");
    query = term
      ? query.or(`and(payment_status.eq.pending_verification,or(${search})),and(advance_status.eq.pending,or(${search}))`)
      : query.or(NEEDS_CHECK);
  } else {
    if (tab) query = query.eq("status", tab as "pending");
    if (term) query = query.or(search);
  }

  // Orders that still need work get a count on their tab.
  const OPEN = ["pending", "confirmed", "printing", "shipped"] as const;
  const [{ data: orders, count }, { count: verifyCount }, ...openCounts] = await Promise.all([
    query.range((page - 1) * PAGE, page * PAGE - 1),
    supabase.from("orders").select("id", { count: "exact", head: true }).or(NEEDS_CHECK).neq("status", "cancelled"),
    ...OPEN.map((s) => supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", s)),
  ]);
  const tabCount: Record<string, number> = { verify: verifyCount ?? 0 };
  OPEN.forEach((s, i) => (tabCount[s] = openCounts[i].count ?? 0));

  // Flag customers whose number has cancelled orders before or is blocked.
  const phones = [...new Set((orders ?? []).map((o) => o.customer_phone))];
  const { data: phoneStats } = phones.length ? await supabase.rpc("admin_phone_stats", { p_phones: phones }) : { data: [] };
  // Which of these orders are already on the print list.
  const orderIds = (orders ?? []).map((o) => o.id);
  const { data: jobRows } = orderIds.length ? await supabase.from("print_jobs").select("order_id").in("order_id", orderIds) : { data: [] };
  const onPrintList = new Set((jobRows ?? []).map((j) => j.order_id));
  const risk = new Map((phoneStats ?? []).map((s) => [s.phone, s]));
  const keyOf = (p: string) => p.replace(/\D/g, "").slice(-10);
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const href = (p: Partial<SP>) => {
    const s = new URLSearchParams(Object.entries({ tab, q, ...p }).filter(([, v]) => v) as [string, string][]).toString();
    return `/admin/orders${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageTitle>Orders</PageTitle>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-1" aria-label="Filter orders">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={href({ tab: t.key, page: undefined })}
              aria-current={tab === t.key ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t.key ? "bg-white text-ink shadow-xs ring-1 ring-line" : "text-ink-soft hover:text-ink",
              )}
            >
              {t.label}
              {!!tabCount[t.key] && <Badge color={t.key === "verify" || t.key === "pending" ? "warning" : "neutral"}>{tabCount[t.key]}</Badge>}
            </Link>
          ))}
        </nav>
        <form className="relative w-full sm:w-72">
          {tab && <input type="hidden" name="tab" value={tab} />}
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
          <Input name="q" defaultValue={q} placeholder="Order #, phone, name, TrxID" className="pl-9" aria-label="Search orders" />
        </form>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-line bg-surface text-xs font-medium text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Payment</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Printing</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(orders ?? []).map((o) => (
              <tr key={o.id} className="hover:bg-surface">
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${o.id}`} className="font-medium hover:text-accent">{o.order_number}</Link>
                  <p className="text-xs text-ink-soft">{formatDate(o.created_at)}</p>
                </td>
                <td className="px-4 py-3">
                  <p>{o.customer_name}</p>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
                    {o.customer_phone}
                    {(() => {
                      const r = risk.get(keyOf(o.customer_phone));
                      if (r?.blocked) return <Badge color="danger">Blocked</Badge>;
                      if (r && r.cancelled > 0)
                        return (
                          <span title="This number has cancelled orders before">
                            <Badge color="danger">{r.cancelled} cancelled</Badge>
                          </span>
                        );
                      return null;
                    })()}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p>{PAYMENT_LABEL[o.payment_method]}</p>
                  {o.advance_status !== "none" ? (
                    <Badge color={ADVANCE_STATUS_COLOR[o.advance_status]}>{ADVANCE_STATUS_LABEL[o.advance_status]}</Badge>
                  ) : (
                    <Badge color={PAYMENT_STATUS_COLOR[o.payment_status]}>{PAYMENT_STATUS_LABEL[o.payment_status]}</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge color={ORDER_STATUS_COLOR[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                </td>
                <td className="px-4 py-3">
                  <SendToPrint orderId={o.id} sent={onPrintList.has(o.id)} cancelled={o.status === "cancelled"} />
                </td>
                <td className="px-4 py-3 text-right">
                  <p className="font-medium tabular-nums">{formatBDT(o.total)}</p>
                  <p className="text-xs text-ink-soft">
                    {o.order_items.reduce((n, i) => n + i.quantity, 0)} item(s)
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders?.length && <p className="p-8 text-center text-ink-soft">{term ? `No orders match “${term}”.` : "No orders here yet."}</p>}
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
