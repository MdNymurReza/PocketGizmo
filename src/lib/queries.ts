import "server-only";
import { createClient } from "@/lib/supabase/server";

export const CARD_SELECT =
  "id, name, slug, base_price, compare_at_price, images, featured, created_at, categories(name, slug), product_variants(stock, is_active, price, options)";

export type CardProduct = {
  id: string;
  name: string;
  slug: string;
  base_price: number;
  compare_at_price: number | null;
  images: string[];
  categories: { name: string; slug: string } | null;
  product_variants: { stock: number; is_active: boolean; price: number; options: Record<string, string> }[];
};

export async function getCategories() {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, name, slug, image").order("sort_order").order("name");
  return data ?? [];
}

export async function getFeatured(limit = 8) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(CARD_SELECT)
    .eq("is_active", true)
    .eq("featured", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as CardProduct[];
}

export type ShopFilters = {
  category?: string;
  q?: string;
  sort?: string;
  min?: string;
  max?: string;
  page?: string;
};

export const PAGE_SIZE = 12;

export async function getProducts(f: ShopFilters) {
  const supabase = await createClient();
  const page = Math.max(1, Number(f.page) || 1);
  const select = f.category
    ? CARD_SELECT.replace("categories(name, slug)", "categories!inner(name, slug)")
    : CARD_SELECT;

  let query = supabase.from("products").select(select, { count: "exact" }).eq("is_active", true);
  if (f.category) query = query.eq("categories.slug", f.category);
  if (f.q?.trim()) {
    const term = f.q.trim().replace(/[%_,()]/g, " ");
    query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
  }
  if (f.min && !isNaN(Number(f.min))) query = query.gte("base_price", Number(f.min));
  if (f.max && !isNaN(Number(f.max))) query = query.lte("base_price", Number(f.max));

  switch (f.sort) {
    case "price-asc":
      query = query.order("base_price", { ascending: true });
      break;
    case "price-desc":
      query = query.order("base_price", { ascending: false });
      break;
    case "name":
      query = query.order("name");
      break;
    default:
      query = query.order("featured", { ascending: false }).order("created_at", { ascending: false });
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await query.range(from, from + PAGE_SIZE - 1);
  return { products: (data ?? []) as unknown as CardProduct[], total: count ?? 0, page };
}

export async function getProductBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*, categories(id, name, slug), product_variants(id, sku, options, price, stock, is_active, sort_order)")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  return {
    ...data,
    product_variants: data.product_variants
      .filter((v) => v.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({ ...v, options: (v.options ?? {}) as Record<string, string> })),
  };
}

export async function getRelated(productId: string, categoryId: string | null, limit = 4) {
  const supabase = await createClient();
  const base = () => supabase.from("products").select(CARD_SELECT).eq("is_active", true).neq("id", productId);
  const same = categoryId ? ((await base().eq("category_id", categoryId).limit(limit)).data ?? []) : [];
  if (same.length >= limit) return same as CardProduct[];
  // Top up with featured/newest products from other categories.
  const { data: more } = await base()
    .not("id", "in", `(${[productId, ...same.map((p) => p.id)].join(",")})`)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit - same.length);
  return [...same, ...(more ?? [])] as CardProduct[];
}
