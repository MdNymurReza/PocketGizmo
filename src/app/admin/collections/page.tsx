import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/ui";
import { CollectionManager } from "@/components/admin/collection-manager";

export const metadata: Metadata = { title: "Collections" };

export default async function CollectionsPage() {
  const supabase = await createClient();
  const [{ data: collections }, { data: products }] = await Promise.all([
    supabase.from("collections").select("*, collection_products(product_id, sort_order)").order("sort_order").order("created_at", { ascending: false }),
    supabase.from("products").select("id, name, is_active").order("name"),
  ]);
  const list = (collections ?? []).map(({ collection_products, ...c }) => ({
    ...c,
    product_ids: [...collection_products].sort((a, b) => a.sort_order - b.sort_order).map((p) => p.product_id),
  }));
  return (
    <>
      <PageTitle>Occasion collections</PageTitle>
      <CollectionManager collections={list} products={products ?? []} />
    </>
  );
}
