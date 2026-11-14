import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StallProductManager } from "@/components/admin/stall-product-manager";

export const metadata: Metadata = { title: "Stall products" };

export default async function StallProductsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("stall_products").select("id, name, price, image").order("name");
  const products = (data ?? []).map((p) => ({ ...p, price: Number(p.price) }));

  return (
    <>
      <Link href="/admin/stall" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ChevronLeft className="size-4" /> Stall orders
      </Link>
      <h1 className="text-2xl font-semibold">Stall products</h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-ink-soft">
        Enter everything you will sell before the stall day. When you take an order, these show as a grid: search or tap a product and it is added with its price.
      </p>
      <StallProductManager products={products} />
    </>
  );
}
