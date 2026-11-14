import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StallOrderForm } from "@/components/admin/stall-order-form";
import { STALL_PICKUP_POINT, dhakaToday } from "@/lib/stall";

export const metadata: Metadata = { title: "New stall order" };

export default async function NewStallOrderPage() {
  const supabase = await createClient();
  // Start with the location of the last order, so it is typed only once per stall day.
  const [{ data: last }, { data: productRows }] = await Promise.all([
    supabase.from("stall_orders").select("stall_location").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("stall_products").select("id, name, price, image").eq("is_active", true).order("name"),
  ]);
  const products = (productRows ?? []).map((p) => ({ ...p, price: Number(p.price) }));

  return (
    <>
      <Link href="/admin/stall" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ChevronLeft className="size-4" /> Stall orders
      </Link>
      <h1 className="mb-6 text-2xl font-semibold">New stall order</h1>
      <StallOrderForm today={dhakaToday()} lastLocation={last?.stall_location || STALL_PICKUP_POINT} products={products} />
    </>
  );
}
