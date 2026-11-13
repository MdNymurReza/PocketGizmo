import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CircleAlert, MapPin, Package, PackageSearch, PenTool, ShoppingBag, Truck } from "lucide-react";
import { getSessionProfile } from "@/lib/supabase/server";
import { ButtonLink, Card, EmptyState } from "@/components/ui";
import { ORDER_SUMMARY_SELECT, OrderRow, OrderSteps } from "@/components/shop/order-row";
import { STATUS_LABEL, formatBDT, formatDay } from "@/lib/utils";

export const metadata: Metadata = { title: "Overview" };

const ACTIVE = ["pending", "confirmed", "printing", "shipped"] as const;

export default async function AccountOverviewPage() {
  const { supabase, user, profile } = await getSessionProfile();
  if (!user) redirect("/login?next=/account");

  const mine = () => supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  const [{ count: total }, { count: active }, { count: delivered }, { data: recent }, { data: current }, { count: quotes }] = await Promise.all([
    mine(),
    mine().in("status", ACTIVE),
    mine().eq("status", "delivered"),
    supabase.from("orders").select(ORDER_SUMMARY_SELECT).eq("user_id", user.id).order("created_at", { ascending: false }).limit(4),
    supabase
      .from("orders")
      .select("order_number, status, total, created_at, courier, tracking_code, payment_method, advance_amount, advance_status")
      .eq("user_id", user.id)
      .in("status", ACTIVE)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("custom_requests").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "quoted"),
  ]);

  const firstName = profile?.full_name?.trim().split(/\s+/)[0];
  const stats = [
    { label: "Orders", value: total ?? 0, icon: Package, href: "/account/orders" },
    { label: "In progress", value: active ?? 0, icon: Truck, href: "/account/orders?tab=active" },
    { label: "Delivered", value: delivered ?? 0, icon: ShoppingBag, href: "/account/orders?tab=delivered" },
  ];
  const due = current
    ? Number(current.total) - (current.advance_status === "rejected" ? 0 : Number(current.advance_amount))
    : 0;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{firstName ? `Welcome back, ${firstName}` : "Welcome back"}</h1>
        <p className="mt-1 text-sm text-ink-soft">Here&apos;s what&apos;s happening with your orders.</p>
      </div>

      {/* Things that need the customer's attention */}
      {!!quotes && (
        <Notice
          href="/account/requests"
          text={`${quotes} custom print quote${quotes > 1 ? "s are" : " is"} waiting for your answer`}
          cta="Review"
        />
      )}
      {!profile?.phone && (
        <Notice href="/account/settings" text="Add your mobile number so we can reach you about deliveries" cta="Add number" />
      )}

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href} className="group rounded-xl border border-line bg-white p-4 shadow-xs transition-colors hover:border-ink/20 sm:p-5">
            <Icon className="size-5 text-ink-soft transition-colors group-hover:text-ink" strokeWidth={1.75} />
            <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
            <p className="text-sm text-ink-soft">{label}</p>
          </Link>
        ))}
      </div>

      {/* The order that's on its way */}
      {current && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-wide text-ink-soft uppercase">Latest order</p>
              <h2 className="mt-1 text-lg font-semibold">
                {current.order_number} <span className="font-normal text-ink-soft">· {STATUS_LABEL[current.status]}</span>
              </h2>
              <p className="mt-0.5 text-sm text-ink-soft">
                Placed {formatDay(current.created_at)}
                {current.payment_method === "cod" && due > 0 && <> · {formatBDT(due)} to pay on delivery</>}
              </p>
            </div>
            <ButtonLink href={`/account/orders/${current.order_number}`} variant="secondary" size="sm">
              View order
            </ButtonLink>
          </div>
          <div className="mt-5">
            <OrderSteps status={current.status} />
          </div>
          {current.status === "shipped" && current.courier && (
            <p className="mt-4 rounded-lg bg-surface px-3 py-2 text-sm">
              With <span className="font-medium">{current.courier}</span>
              {current.tracking_code && (
                <>
                  , tracking number <span className="font-mono font-medium">{current.tracking_code}</span>
                </>
              )}
            </p>
          )}
        </Card>
      )}

      {/* Recent orders */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-semibold">Recent orders</h2>
          {!!total && total > 4 && (
            <Link href="/account/orders" className="group inline-flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink">
              View all <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
        {recent?.length ? (
          <ul className="divide-y divide-line">
            {recent.map((o) => (
              <li key={o.order_number}>
                <OrderRow order={o} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Package}
            title="No orders yet"
            text="When you place an order, you'll be able to follow it here."
            action={<ButtonLink href="/shop">Start shopping</ButtonLink>}
          />
        )}
      </Card>

      {/* Shortcuts */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Shortcut href="/custom-order" icon={PenTool} title="Custom print" text="Send us a design to print" />
        <Shortcut href="/track" icon={PackageSearch} title="Track an order" text="Look up any order by number" />
        <Shortcut href="/account/addresses" icon={MapPin} title="Addresses" text="Manage where we deliver" />
      </div>
    </div>
  );
}

function Notice({ href, text, cta }: { href: string; text: string; cta: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-accent/25 bg-accent/5 px-4 py-3 text-sm transition-colors hover:border-accent/50"
    >
      <CircleAlert className="size-4 shrink-0 text-accent" />
      <span className="flex-1 font-medium">{text}</span>
      <span className="inline-flex shrink-0 items-center gap-1 font-medium text-accent">
        {cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function Shortcut({ href, icon: Icon, title, text }: { href: string; icon: React.ElementType; title: string; text: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-xl border border-line p-4 transition-colors hover:border-ink/20 hover:bg-surface">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-ink group-hover:bg-white">
        <Icon className="size-[18px]" strokeWidth={1.75} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-ink-soft">{text}</span>
      </span>
    </Link>
  );
}
