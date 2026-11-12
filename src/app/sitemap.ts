import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  // Public, cookie-free client: the sitemap only lists publicly visible data.
  const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from("products").select("slug, updated_at").eq("is_active", true),
    supabase.from("categories").select("slug"),
  ]);

  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/custom-order`, changeFrequency: "monthly", priority: 0.6 },
    ...["/shipping-policy", "/refund-policy", "/terms", "/privacy"].map((p) => ({ url: `${base}${p}`, changeFrequency: "yearly" as const, priority: 0.3 })),
    ...(categories ?? []).map((c) => ({ url: `${base}/shop?category=${c.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...(products ?? []).map((p) => ({ url: `${base}/product/${p.slug}`, lastModified: p.updated_at, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
