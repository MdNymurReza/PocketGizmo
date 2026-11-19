"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sendBackInStockAlerts } from "@/lib/sms";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

export type ActionResult = { error?: string; id?: string };

const fail = (e: unknown): ActionResult => ({ error: e instanceof Error ? e.message : String(e) });

function friendly(message: string) {
  if (message.includes("duplicate key") && message.includes("slug")) return "That URL slug is already used";
  if (message.includes("duplicate key") && message.includes("sku")) return "That SKU is already used by another variant";
  return message;
}

/* ---------------- Categories ---------------- */

const categorySchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Name is required"),
  slug: z.string().trim().optional(),
  sort_order: z.coerce.number().int().default(0),
});

export async function saveCategory(input: z.input<typeof categorySchema>): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { id, name, sort_order } = parsed.data;
    const slug = slugify(parsed.data.slug || name);
    const row = { name, slug, sort_order };
    const { data, error } = id
      ? await supabase.from("categories").update(row).eq("id", id).select("id").single()
      : await supabase.from("categories").insert(row).select("id").single();
    if (error) return { error: friendly(error.message) };
    revalidatePath("/admin/categories");
    revalidatePath("/", "layout");
    return { id: data.id };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/admin/categories");
    return {};
  } catch (e) {
    return fail(e);
  }
}

/* ---------------- Products ---------------- */

const money = z.coerce.number().min(0, "Price can't be negative");

const variantSchema = z.object({
  id: z.uuid().optional(),
  sku: z.string().trim().optional(),
  options: z.record(z.string(), z.string()),
  price: money,
  stock: z.coerce.number().int().min(0, "Stock can't be negative"),
  low_stock_threshold: z.coerce.number().int().min(0).default(3),
  is_active: z.boolean().default(true),
});

const productSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Product name is required"),
  slug: z.string().trim().optional(),
  description: z.string().default(""),
  category_id: z.string().optional(),
  compare_at_price: z.union([money, z.literal(""), z.null()]).optional(),
  is_active: z.boolean(),
  featured: z.boolean(),
  preorder_enabled: z.boolean().default(false),
  preorder_note: z.string().trim().max(120).default(""),
  images: z.array(z.url()).max(10),
  optionNames: z.array(z.string().trim().min(1)).max(3),
  variants: z.array(variantSchema).min(1, "Add at least one variant"),
});

export type ProductInput = z.input<typeof productSchema>;

export async function saveProduct(input: ProductInput): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { error: `${issue.path.join(" › ")}: ${issue.message}` };
    }
    const p = parsed.data;

    // Every variant needs a value for every option, and combinations must be unique.
    const seen = new Set<string>();
    for (const v of p.variants) {
      const key = p.optionNames.map((n) => (v.options[n] ?? "").trim()).join("|");
      if (p.optionNames.some((n) => !(v.options[n] ?? "").trim())) return { error: "Every variant needs a value for each option" };
      if (seen.has(key.toLowerCase())) return { error: `Duplicate variant: ${key.replaceAll("|", " / ")}` };
      seen.add(key.toLowerCase());
    }

    const activePrices = p.variants.filter((v) => v.is_active).map((v) => v.price);
    const row = {
      name: p.name,
      slug: slugify(p.slug || p.name),
      description: p.description,
      category_id: p.category_id || null,
      base_price: Math.min(...(activePrices.length ? activePrices : p.variants.map((v) => v.price))),
      compare_at_price: p.compare_at_price === "" || p.compare_at_price == null ? null : Number(p.compare_at_price),
      is_active: p.is_active,
      featured: p.featured,
      preorder_enabled: p.preorder_enabled,
      preorder_note: p.preorder_note || null,
      images: p.images,
    };

    const { data: saved, error } = p.id
      ? await supabase.from("products").update(row).eq("id", p.id).select("id").single()
      : await supabase.from("products").insert(row).select("id").single();
    if (error) return { error: friendly(error.message) };
    const productId = saved.id;

    // Sync variants
    const { data: existing } = await supabase.from("product_variants").select("id, stock").eq("product_id", productId);
    const existingMap = new Map((existing ?? []).map((v) => [v.id, v.stock]));
    const keepIds = new Set(p.variants.filter((v) => v.id).map((v) => v.id!));

    // Removed variants: deactivate if they were ever ordered (keeps history), otherwise delete.
    const removed = [...existingMap.keys()].filter((id) => !keepIds.has(id));
    if (removed.length) {
      const { data: ordered } = await supabase.from("order_items").select("variant_id").in("variant_id", removed);
      const orderedIds = new Set((ordered ?? []).map((o) => o.variant_id));
      const toDelete = removed.filter((id) => !orderedIds.has(id));
      const toDeactivate = removed.filter((id) => orderedIds.has(id));
      if (toDelete.length) await supabase.from("product_variants").delete().in("id", toDelete);
      if (toDeactivate.length) await supabase.from("product_variants").update({ is_active: false }).in("id", toDeactivate);
    }

    const restocked: string[] = [];
    for (const [i, v] of p.variants.entries()) {
      const options = Object.fromEntries(p.optionNames.map((n) => [n, v.options[n].trim()]));
      const fields = {
        sku: v.sku || null,
        options,
        price: v.price,
        low_stock_threshold: v.low_stock_threshold,
        is_active: v.is_active,
        sort_order: i,
      };
      let variantId = v.id && existingMap.has(v.id) ? v.id : undefined;
      let currentStock = variantId ? existingMap.get(variantId)! : 0;

      if (variantId) {
        const { error: e } = await supabase.from("product_variants").update(fields).eq("id", variantId);
        if (e) return { error: friendly(e.message), id: productId };
      } else {
        const { data: ins, error: e } = await supabase
          .from("product_variants")
          .insert({ ...fields, product_id: productId, stock: 0 })
          .select("id")
          .single();
        if (e) return { error: friendly(e.message), id: productId };
        variantId = ins.id;
        currentStock = 0;
      }

      // Stock changes always go through the audited function.
      const delta = v.stock - currentStock;
      if (delta !== 0) {
        const { error: e } = await supabase.rpc("admin_adjust_stock", {
          p_variant: variantId,
          p_delta: delta,
          p_reason: currentStock === 0 && delta > 0 ? "restock" : "adjust",
          p_note: "Edited in product form",
        });
        if (e) return { error: e.message, id: productId };
        if (currentStock <= 0 && v.stock > 0) restocked.push(variantId);
      }
    }
    if (restocked.length) after(() => sendBackInStockAlerts(supabase, restocked));

    revalidatePath("/admin/products");
    revalidatePath("/admin/inventory");
    revalidatePath("/", "layout");
    return { id: productId };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { count } = await supabase.from("order_items").select("id", { count: "exact", head: true }).eq("product_id", id);
    if (count && count > 0) {
      // Keep products that have orders, so order history and sales reports stay intact.
      const { error } = await supabase.from("products").update({ is_active: false }).eq("id", id);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) return { error: error.message };
    }
    revalidatePath("/admin/products");
    revalidatePath("/", "layout");
    return {};
  } catch (e) {
    return fail(e);
  }
}

/* ---------------- Inventory ---------------- */

const adjustSchema = z.object({
  variantId: z.uuid(),
  delta: z.coerce.number().int().refine((n) => n !== 0, "Enter a non-zero amount"),
  reason: z.enum(["restock", "adjust"]),
  note: z.string().default(""),
});

export async function adjustStock(input: z.input<typeof adjustSchema>): Promise<ActionResult & { stock?: number }> {
  try {
    const { supabase } = await requireAdmin();
    const parsed = adjustSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { variantId, delta, reason, note } = parsed.data;
    const { data, error } = await supabase.rpc("admin_adjust_stock", {
      p_variant: variantId,
      p_delta: delta,
      p_reason: reason,
      p_note: note,
    });
    if (error) return { error: error.message.includes("stock_check") ? "Stock cannot go below zero" : error.message };
    if (delta > 0 && data > 0 && data - delta <= 0) after(() => sendBackInStockAlerts(supabase, [variantId]));
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/products");
    return { stock: data };
  } catch (e) {
    return fail(e);
  }
}
