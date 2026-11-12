import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/ui";
import { CategoryManager } from "@/components/admin/category-manager";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug, sort_order, products(count)")
    .order("sort_order")
    .order("name");

  return (
    <>
      <PageTitle>Categories</PageTitle>
      <CategoryManager
        categories={(categories ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          sort_order: c.sort_order,
          productCount: (c.products as unknown as { count: number }[])[0]?.count ?? 0,
        }))}
      />
    </>
  );
}
