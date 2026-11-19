"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

const optDate = z.string().optional().transform((v) => (v ? new Date(`${v}T00:00:00+06:00`).toISOString() : null));
const optEndDate = z.string().optional().transform((v) => (v ? new Date(`${v}T23:59:59+06:00`).toISOString() : null));
const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

const schema = z
  .object({
    id: z.uuid().optional(),
    title: z.string().trim().min(2, "Give the collection a title").max(80),
    slug: z.string().trim().max(80).optional(),
    subtitle: optText(240),
    banner_image: z.union([z.url(), z.literal("")]).optional().transform((v) => v || null),
    coupon_code: optText(30).transform((v) => v?.toUpperCase() ?? null),
    starts_at: optDate,
    ends_at: optEndDate,
    is_active: z.boolean(),
    sort_order: z.coerce.number().int().min(0).max(9999).default(0),
    product_ids: z.array(z.uuid()).max(300),
  })
  .refine((c) => !c.starts_at || !c.ends_at || c.starts_at < c.ends_at, { message: "End date must be after start date", path: ["ends_at"] });

export type CollectionInput = z.input<typeof schema>;

export async function saveCollection(input: CollectionInput): Promise<{ error?: string }> {
  try {
    const { supabase } = await requireAdmin();
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { id, product_ids, ...c } = parsed.data;
    const slug = slugify(c.slug || c.title);
    if (!slug) return { error: "The link name needs letters or numbers" };
    if (c.coupon_code) {
      const { data: coupon } = await supabase.from("coupons").select("id").eq("code", c.coupon_code).maybeSingle();
      if (!coupon) return { error: `There is no coupon called ${c.coupon_code}. Create it on the Coupons page first.` };
    }
    const row = { ...c, slug };
    const res = id
      ? await supabase.from("collections").update(row).eq("id", id).select("id").single()
      : await supabase.from("collections").insert(row).select("id").single();
    if (res.error) return { error: res.error.message.includes("duplicate") ? "Another collection already uses that link name" : res.error.message };
    const cid = res.data.id;
    const { error: delErr } = await supabase.from("collection_products").delete().eq("collection_id", cid);
    if (delErr) return { error: delErr.message };
    if (product_ids.length) {
      const { error } = await supabase
        .from("collection_products")
        .insert([...new Set(product_ids)].map((product_id, i) => ({ collection_id: cid, product_id, sort_order: i })));
      if (error) return { error: error.message };
    }
    revalidatePath("/admin/collections");
    revalidatePath("/", "layout");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteCollection(id: string): Promise<{ error?: string }> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("collections").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/admin/collections");
    revalidatePath("/", "layout");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
