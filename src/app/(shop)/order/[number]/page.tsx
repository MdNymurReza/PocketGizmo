import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { TrackedOrder } from "@/lib/orders";
import { OrderDetails } from "@/components/shop/order-details";
import { ButtonLink } from "@/components/ui";
import { CopyLink } from "@/components/shop/copy-link";
import { SuccessMark } from "@/components/motion";
import { formatBDT } from "@/lib/utils";

export const metadata: Metadata = { title: "Order confirmed", robots: { index: false } };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const [{ number }, { t }] = await Promise.all([params, searchParams]);
  if (!t || !UUID_RE.test(t)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.rpc("track_order", { p_order_number: number, p_phone: "", p_token: t });
  if (!data) notFound();
  const order = data as unknown as TrackedOrder;
  const advance = Number(order.advance_amount ?? 0);
  const awaitingPayment = order.payment_status === "pending_verification" || order.advance_status === "pending";
  const dueOnDelivery = Number(order.total) - (order.advance_status === "rejected" ? 0 : advance);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mb-10 flex flex-col gap-6 border-b border-line pb-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SuccessMark tone={awaitingPayment ? "warning" : "success"} />
          <h1 className="mt-4 text-3xl font-semibold">
            Thank you, {order.customer_name.split(" ")[0]}!
          </h1>
          <p className="mt-2 max-w-xl text-ink-soft">
            Your order <span className="font-medium text-ink">{order.order_number}</span> has been placed.{" "}
            {awaitingPayment
              ? order.payment_method === "cod"
                ? "We're verifying your delivery charge payment and will confirm your order shortly."
                : "We're verifying your payment and will confirm your order shortly."
              : order.payment_method === "cod"
                ? "Please keep the exact amount ready when your order arrives."
                : "We'll let you know when it ships."}
            {order.payment_method === "cod" && advance > 0 && (
              <span className="mt-2 block">
                Pay <span className="font-medium text-ink">{formatBDT(dueOnDelivery)}</span> in cash on delivery.
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyLink label="Copy tracking link" />
          <ButtonLink href="/shop" variant="secondary">Continue shopping</ButtonLink>
        </div>
      </div>
      <OrderDetails order={order} />
      <p className="mt-8 text-sm text-ink-soft">
        Bookmark this page to check on your order, or track it any time on the <Link href="/track" className="font-medium text-ink underline underline-offset-4">Track order</Link> page with your order number and phone.
      </p>
    </div>
  );
}
