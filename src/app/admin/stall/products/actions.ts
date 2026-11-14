"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/server";

type Result = { error?: string; count?: number };
const fail = (e: unknown): Result => ({ error: e instanceof Error ? e.message : String(e) });

function refresh() {
  revalidatePath("/admin/stall/products");
  revalidatePath("/admin/stall/new");
}

const schema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Enter the product name").max(200),
  price: z.number({ error: "Enter a price" }).min(0, "Enter a price").max(1_000_000),
});

/** Add a product to the stall list, or change its name or price. */
export async function saveStallProduct(input: z.input<typeof schema>): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { id, name, price } = parsed.data;
    const { error } = id
      ? await supabase.from("stall_products").update({ name, price }).eq("id", id)
      : await supabase.from("stall_products").insert({ name, price });
    if (error) return { error: error.code === "23505" ? `“${name}” is already in the list` : "Couldn't save the product" };
    refresh();
    return {};
  } catch (e) {
    return fail(e);
  }
}

export async function deleteStallProduct(id: string): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    if (!z.uuid().safeParse(id).success) return { error: "Invalid product" };
    const { error } = await supabase.from("stall_products").delete().eq("id", id);
    if (error) return { error: "Couldn't delete the product" };
    refresh();
    return {};
  } catch (e) {
    return fail(e);
  }
}

/** Copy the products of the website shop into the stall list. Products already in the list (same name) are skipped. */
export async function importShopProducts(): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    const [{ data: shop }, { data: existing }] = await Promise.all([
      supabase.from("products").select("name, base_price, images").eq("is_active", true).order("name"),
      supabase.from("stall_products").select("name"),
    ]);
    const have = new Set((existing ?? []).map((p) => p.name.trim().toLowerCase()));
    const rows = (shop ?? [])
      .filter((p) => !have.has(p.name.trim().toLowerCase()))
      .map((p) => ({ name: p.name.trim(), price: Number(p.base_price), image: p.images[0] ?? null }));
    if (!rows.length) return { count: 0 };
    const { error } = await supabase.from("stall_products").insert(rows);
    if (error) return { error: "Couldn't copy the products" };
    refresh();
    return { count: rows.length };
  } catch (e) {
    return fail(e);
  }
}
