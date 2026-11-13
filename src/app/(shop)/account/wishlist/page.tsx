import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { getSessionProfile } from "@/lib/supabase/server";
import { CARD_SELECT, type CardProduct } from "@/lib/queries";
import { ProductGrid } from "@/components/shop/product-card";
import { ButtonLink, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Saved items" };

export default async function WishlistPage() {
  const { supabase } = await getSessionProfile();
  // Row-level security returns only this customer's saved items.
  const { data: saved } = await supabase.from("wishlist_items").select("product_id").order("created_at", { ascending: false }).limit(100);
  const ids = (saved ?? []).map((s) => s.product_id);
  const { data } = ids.length ? await supabase.from("products").select(CARD_SELECT).eq("is_active", true).in("id", ids) : { data: [] };
  // Keep the order in which the customer saved them, newest first.
  const products = ((data ?? []) as unknown as (CardProduct & { id: string })[]).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));

  return (
    <>
      <h1 className="text-2xl font-semibold">Saved items</h1>
      <p className="mt-1 text-sm text-ink-soft">Products you saved for later. Each one shows if it is in stock now.</p>
      {products.length ? (
        <div className="mt-8">
          <ProductGrid products={products} />
        </div>
      ) : (
        <EmptyState
          icon={Heart}
          title="Nothing saved yet"
          text="Open a product and click “Save” to keep it here."
          action={<ButtonLink href="/shop">Browse the shop</ButtonLink>}
          className="mt-8 rounded-xl border border-dashed border-line"
        />
      )}
    </>
  );
}
