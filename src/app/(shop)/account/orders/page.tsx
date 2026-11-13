import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Package } from "lucide-react";
import { getSessionProfile } from "@/lib/supabase/server";
import { ButtonLink, Card, EmptyState } from "@/components/ui";
import { ORDER_SUMMARY_SELECT, OrderRow } from "@/components/shop/order-row";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };

const PAGE = 10;
const TABS = [
  { key: "", label: "All" },
  { key: "active", label: "In progress" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
] as const;

export default async function AccountOrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string }> }) {
  const { tab = "", page: pageStr } = await searchParams;
  const page = Math.max(1, Number(pageStr) || 1);
  const { supabase, user } = await getSessionProfile();
  if (!user) redirect("/login?next=/account/orders");

  let query = supabase
    .from("orders")
    .select(ORDER_SUMMARY_SELECT, { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (tab === "active") query = query.in("status", ["pending", "confirmed", "printing", "shipped"]);
  else if (tab === "delivered" || tab === "cancelled") query = query.eq("status", tab);

  const { data: orders, count } = await query.range((page - 1) * PAGE, page * PAGE - 1);
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const href = (t: string, p = 1) => {
    const s = new URLSearchParams({ ...(t && { tab: t }), ...(p > 1 && { page: String(p) }) }).toString();
    return `/account/orders${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold sm:text-3xl">Orders</h1>
      <p className="mt-1 text-sm text-ink-soft">Everything you&apos;ve ordered from us.</p>

      <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-line" aria-label="Filter orders">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={href(t.key)}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              tab === t.key ? "border-ink text-ink" : "border-transparent text-ink-soft hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <Card className="mt-6 overflow-hidden p-0">
        {orders?.length ? (
          <ul className="divide-y divide-line">
            {orders.map((o) => (
              <li key={o.order_number}>
                <OrderRow order={o} />
              </li>
            ))}
          </ul>
        ) : tab ? (
          <EmptyState
            icon={Package}
            title="Nothing here"
            text="You have no orders with this status."
            action={<ButtonLink href="/account/orders" variant="secondary">View all orders</ButtonLink>}
          />
        ) : (
          <EmptyState
            icon={Package}
            title="No orders yet"
            text="When you place an order, you'll be able to follow it here."
            action={<ButtonLink href="/shop">Start shopping</ButtonLink>}
          />
        )}
      </Card>

      {pages > 1 && (
        <nav className="mt-6 flex justify-center gap-1" aria-label="Pagination">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={href(tab, n)}
              aria-current={n === page ? "page" : undefined}
              className={cn(
                "grid size-9 place-items-center rounded-md text-sm font-medium",
                n === page ? "bg-ink text-white" : "text-ink-soft hover:bg-surface hover:text-ink",
              )}
            >
              {n}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
