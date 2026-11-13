import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Star } from "lucide-react";
import { getSessionProfile } from "@/lib/supabase/server";
import type { TrackedOrder } from "@/lib/orders";
import { OrderDetails } from "@/components/shop/order-details";
import { ButtonLink } from "@/components/ui";
import { formatDay } from "@/lib/utils";

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

  // Delivered orders invite a review of each product that is still in the shop.
  const productIds = [...new Set(o.order_items.map((i) => i.product_id).filter((id): id is string => Boolean(id)))];
  const [{ data: products }, { data: myReviews }] =
    o.status === "delivered" && productIds.length
      ? await Promise.all([
          supabase.from("products").select("id, name, slug").in("id", productIds).eq("is_active", true),
          supabase.from("reviews").select("product_id").eq("user_id", user.id).in("product_id", productIds),
        ])
      : [{ data: [] }, { data: [] }];
  const reviewable = products ?? [];
  const reviewed = new Set((myReviews ?? []).map((r) => r.product_id));

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
      details: i.details,
    })),
    history: [...o.order_status_history].sort((a, b) => a.created_at.localeCompare(b.created_at)),
  };

  return (
    <div>
      <Link href="/account/orders" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ChevronLeft className="size-4" /> All orders
      </Link>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Order {order.order_number}</h1>
          <p className="mt-1 text-sm text-ink-soft">Placed {formatDay(order.created_at)}</p>
        </div>
        <ButtonLink href="/shop" variant="secondary" size="sm">
          Shop again
        </ButtonLink>
      </div>

      {reviewable.length > 0 && (
        <div className="mb-8 rounded-xl border border-accent/25 bg-accent/5 p-5">
          <p className="flex items-center gap-2 font-medium">
            <Star className="size-4 fill-amber-400" strokeWidth={0} /> How was your order?
          </p>
          <p className="mt-1 text-sm text-ink-soft">Your review helps other customers choose.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {reviewable.map((p) => (
              <li key={p.id}>
                <ButtonLink href={`/product/${p.slug}#reviews`} variant="secondary" size="sm">
                  {reviewed.has(p.id) ? "Edit review of" : "Review"} {p.name}
                </ButtonLink>
              </li>
            ))}
          </ul>
        </div>
      )}

      <OrderDetails order={order} />
    </div>
  );
}
