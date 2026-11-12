import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/ui";
import { ProductForm } from "@/components/admin/product-form";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase.from("categories").select("id, name").order("sort_order");
  return (
    <>
      <PageTitle>New product</PageTitle>
      <ProductForm categories={categories ?? []} />
    </>
  );
}
