import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/ui";
import { ProductForm, type ProductFormValues } from "@/components/admin/product-form";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: product }, { data: categories }, { count: waiting }] = await Promise.all([
    supabase.from("products").select("*, product_variants(*)").eq("id", id).maybeSingle(),
    supabase.from("categories").select("id, name").order("sort_order"),
    supabase
      .from("stock_alerts")
      .select("id, product_variants!inner(product_id)", { count: "exact", head: true })
      .eq("product_variants.product_id", id)
      .is("notified_at", null),
  ]);
  if (!product) notFound();

  const variants = [...product.product_variants].sort((a, b) => a.sort_order - b.sort_order);
  // Option names come from the variants' option keys, in first-seen order.
  const optionNames = [...new Set(variants.flatMap((v) => Object.keys((v.options ?? {}) as object)))];

  const initial: ProductFormValues = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    category_id: product.category_id ?? "",
    compare_at_price: product.compare_at_price?.toString() ?? "",
    is_active: product.is_active,
    featured: product.featured,
    preorder_enabled: product.preorder_enabled,
    preorder_note: product.preorder_note ?? "",
    waiting: waiting ?? 0,
    images: product.images,
    optionNames,
    variants: variants.map((v) => ({
      id: v.id,
      sku: v.sku ?? "",
      options: (v.options ?? {}) as Record<string, string>,
      price: String(v.price),
      stock: String(v.stock),
      low_stock_threshold: String(v.low_stock_threshold),
      is_active: v.is_active,
    })),
  };

  return (
    <>
      <PageTitle
        action={
          product.is_active ? (
            <Link href={`/product/${product.slug}`} className="font-medium text-accent hover:underline" target="_blank">
              View on store ↗
            </Link>
          ) : null
        }
      >
        {product.name}
      </PageTitle>
      <ProductForm key={product.updated_at} initial={initial} categories={categories ?? []} />
    </>
  );
}
