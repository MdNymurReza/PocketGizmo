import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { variantLabel } from "@/lib/utils";

/**
 * Product catalog for Facebook / Instagram Shops (Meta Commerce Manager → Catalog → Data sources → Data feed → scheduled URL).
 * One row per variant, grouped by product, so Meta shows the colors and sizes as choices.
 */
export const revalidate = 3600;

const csv = (v: unknown) => {
  const s = String(v ?? "").replace(/\r?\n+/g, " ").trim();
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const money = (n: number) => `${Number(n).toFixed(2)} BDT`;
const pick = (o: Record<string, string>, ...keys: string[]) => {
  const k = Object.keys(o).find((key) => keys.includes(key.toLowerCase()));
  return k ? o[k] : "";
};

export async function GET() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  // Public, cookie-free client: the feed only lists what anyone can see in the shop.
  const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const [{ data: products }, { data: st }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, slug, description, base_price, compare_at_price, images, preorder_enabled, categories(name), product_variants(id, sku, options, price, stock, is_active)")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    supabase.from("settings").select("store_name").eq("id", 1).single(),
  ]);
  const brand = st?.store_name ?? "PocketGizmo";

  const header = ["id", "item_group_id", "title", "description", "availability", "condition", "price", "sale_price", "link", "image_link", "additional_image_link", "brand", "product_type", "color", "size", "quantity_to_sell_on_facebook"];
  const lines = [header.join(",")];

  for (const p of products ?? []) {
    if (!p.images.length) continue; // Meta rejects items without an image.
    const variants = p.product_variants.filter((v) => v.is_active);
    const description = (p.description || p.name).slice(0, 5000);
    for (const v of variants.length ? variants : [null]) {
      const opts = (v?.options ?? {}) as Record<string, string>;
      const label = variantLabel(opts);
      const price = Number(v?.price ?? p.base_price);
      const compare = Number(p.compare_at_price ?? 0);
      const stock = v?.stock ?? 0;
      const availability = stock > 0 ? "in stock" : p.preorder_enabled ? "preorder" : "out of stock";
      lines.push(
        [
          v?.sku || v?.id || p.id,
          p.id,
          (label ? `${p.name} - ${label}` : p.name).slice(0, 150),
          description,
          availability,
          "new",
          money(compare > price ? compare : price),
          compare > price ? money(price) : "",
          `${base}/product/${p.slug}`,
          p.images[0],
          p.images.slice(1, 10).join(","),
          brand,
          p.categories?.name ?? "",
          pick(opts, "color", "colour"),
          pick(opts, "size"),
          Math.max(0, stock),
        ]
          .map(csv)
          .join(","),
      );
    }
  }

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600" },
  });
}
