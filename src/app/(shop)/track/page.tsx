import type { Metadata } from "next";
import { PackageSearch } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { TrackedOrder } from "@/lib/orders";
import { BD_PHONE_RE, normalizePhone } from "@/lib/bd";
import { OrderDetails } from "@/components/shop/order-details";
import { StallOrderStatus, type TrackedStallOrder } from "@/components/shop/stall-order-status";
import { Button, Field, Input } from "@/components/ui";

export const metadata: Metadata = { title: "Track your order" };

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ order?: string; phone?: string }> }) {
  const { order = "", phone = "" } = await searchParams;
  const submitted = Boolean(order || phone);

  let result: TrackedOrder | null = null;
  let stallResult: TrackedStallOrder | null = null;
  let error = "";
  // Be forgiving: "10002" → "PG-10002", and allow spaces or dashes in the phone number.
  // Orders taken at the stall have numbers like ST-1001 ("st1001" works too).
  const stallMatch = order.trim().match(/^st[\s-]*([a-z]{0,2}\d+)$/i);
  const orderNumber = stallMatch ? `ST-${stallMatch[1].toUpperCase()}` : /^\d+$/.test(order.trim()) ? `PG-${order.trim()}` : order.trim();
  const phoneDigits = normalizePhone(phone);
  if (submitted) {
    if (!orderNumber) error = "Enter your order number.";
    else if (!BD_PHONE_RE.test(phoneDigits)) error = "Enter the 11-digit mobile number used for the order (e.g. 01712345678).";
    else {
      const supabase = await createClient();
      if (stallMatch) {
        const { data } = await supabase.rpc("track_stall_order", { p_order_number: orderNumber, p_phone: phoneDigits });
        stallResult = data ?? null;
      }
      const { data } = stallMatch ? { data: null } : await supabase.rpc("track_order", {
        p_order_number: orderNumber,
        p_phone: phoneDigits,
        p_token: null as unknown as string,
      });
      result = (data as unknown as TrackedOrder) ?? null;
      if (!result && !stallResult) error = "We couldn't find an order with that number and phone. Please check and try again.";
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-xl text-center">
        <PackageSearch className="mx-auto size-8 text-ink-soft" strokeWidth={1.5} />
        <h1 className="mt-4 text-3xl font-semibold">Track your order</h1>
        <p className="mt-2 text-ink-soft">Enter your order number and the mobile number you used at checkout.</p>
      </div>

      <form className="mx-auto mt-8 grid max-w-xl gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Order number">
          <Input name="order" defaultValue={order} placeholder="PG-10001 or ST-1001" className="uppercase" required />
        </Field>
        <Field label="Mobile number">
          <Input name="phone" type="tel" inputMode="tel" defaultValue={phone} placeholder="01XXXXXXXXX" required />
        </Field>
        <Button type="submit">Track</Button>
      </form>

      {error && (
        <p role="alert" className="mx-auto mt-6 max-w-xl rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {stallResult && (
        <div className="mt-12">
          <h2 className="mb-6 text-center text-xl font-semibold">Order {stallResult.order_number}</h2>
          <StallOrderStatus order={stallResult} />
        </div>
      )}

      {result && (
        <div className="mt-12">
          <h2 className="mb-6 text-xl font-semibold">Order {result.order_number}</h2>
          <OrderDetails order={result} />
        </div>
      )}
    </div>
  );
}
