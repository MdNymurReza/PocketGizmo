import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getSessionProfile } from "@/lib/supabase/server";
import type { TrackedOrder } from "@/lib/orders";
import { OrderDetails } from "@/components/shop/order-details";

export const metadata: Metadata = { title: "Order details" };

export default async function AccountOrderPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const { supabase, user } = await getSessionProfile();
  if (!user) redirect(`/login?next=/account/orders/${number}`);

  // RLS limits this to the signed-in customer's own orders.
  const { data: o } = await supabase
    .from("orders")
    .select("*, order_items(*), order_status_history(*)")
    .eq("order_number", number)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!o) notFound();

  const order: TrackedOrder = {
    ...o,
    subtotal: Number(o.subtotal),
    discount: Number(o.discount),
    shipping_fee: Number(o.shipping_fee),
    total: Number(o.total),
    items: o.order_items.map((i) => ({
      name: i.product_name,
      options: i.variant_options as Record<string, string>,
      image: i.image,
      unit_price: Number(i.unit_price),
      quantity: i.quantity,
      line_total: Number(i.line_total),
    })),
    history: [...o.order_status_history].sort((a, b) => a.created_at.localeCompare(b.created_at)),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/account" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ChevronLeft className="size-4" /> My account
      </Link>
      <h1 className="mb-8 text-3xl font-semibold">Order {order.order_number}</h1>
      <OrderDetails order={order} />
    </div>
  );
}
