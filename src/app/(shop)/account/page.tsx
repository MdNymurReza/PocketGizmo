import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, LogOut, Package, Settings } from "lucide-react";
import { ORDER_STATUS_COLOR } from "@/lib/orders";
import { STATUS_LABEL, formatBDT, formatDate } from "@/lib/utils";
import { getSessionProfile } from "@/lib/supabase/server";
import { logout } from "../(auth)/actions";
import { Badge, Button, ButtonLink, Card } from "@/components/ui";
import { ProfileForm } from "@/components/shop/profile-form";
import { MyCustomRequests } from "@/components/shop/my-custom-requests";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const { supabase, user, profile } = await getSessionProfile();
  if (!user) redirect("/login?next=/account");
  const [{ data: orders }, { data: requests }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, created_at, status, total")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("custom_requests")
      .select("id, description, status, quoted_price, admin_note, quantity, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const firstName = profile?.full_name?.trim().split(/\s+/)[0];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <h1 className="text-3xl font-semibold">{firstName ? `Hi, ${firstName}` : "My account"}</h1>
          <p className="mt-1 text-sm text-ink-soft">{user.email}</p>
        </div>
        <form action={logout}>
          <Button variant="secondary" size="sm" type="submit">
            <LogOut className="size-4" /> Log out
          </Button>
        </form>
      </div>

      <div className="mt-8 grid gap-6">
        <Card>
          <h2 className="font-semibold">Profile</h2>
          <p className="mb-5 text-sm text-ink-soft">Used for delivery and order updates.</p>
          <ProfileForm fullName={profile?.full_name ?? ""} phone={profile?.phone ?? ""} />
        </Card>

        <Card className="p-0">
          <h2 className="border-b border-line px-5 py-4 font-semibold">Orders</h2>
          {orders?.length ? (
            <ul className="divide-y divide-line">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/account/orders/${o.order_number}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 text-sm hover:bg-surface">
                    <span className="font-medium">{o.order_number}</span>
                    <span className="text-ink-soft">{formatDate(o.created_at).split(",")[0]}</span>
                    <Badge color={ORDER_STATUS_COLOR[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                    <span className="ml-auto font-medium tabular-nums">{formatBDT(o.total)}</span>
                    <ChevronRight className="size-4 text-ink-soft" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5">
              <p className="flex items-center gap-3 text-sm text-ink-soft">
                <Package className="size-5" strokeWidth={1.75} /> You haven&apos;t placed any orders yet.
              </p>
              <ButtonLink href="/shop" variant="secondary" size="sm">Start shopping</ButtonLink>
            </div>
          )}
        </Card>

        {!!requests?.length && <MyCustomRequests requests={requests} />}

        {profile?.role === "admin" && (
          <Card className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Settings className="size-5 text-ink-soft" strokeWidth={1.75} />
              <div>
                <h2 className="font-semibold">Store admin</h2>
                <p className="text-sm text-ink-soft">Manage products, stock and orders.</p>
              </div>
            </div>
            <ButtonLink href="/admin" size="sm">Open admin</ButtonLink>
          </Card>
        )}
      </div>
    </div>
  );
}
