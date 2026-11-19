"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/server";

const optDate = z.string().optional().transform((v) => (v ? new Date(`${v}T00:00:00+06:00`).toISOString() : null));
const optEndDate = z.string().optional().transform((v) => (v ? new Date(`${v}T23:59:59+06:00`).toISOString() : null));
const int = (min: number) => z.coerce.number().int().min(min);

const schema = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(2, "Give the deal a name").max(60),
    kind: z.enum(["buy_x_get_y", "n_for_price"]),
    buy_qty: z.union([int(1), z.literal("")]).optional(),
    get_qty: z.union([int(1), z.literal("")]).optional(),
    bundle_qty: z.union([int(2), z.literal("")]).optional(),
    bundle_price: z.union([z.coerce.number().positive(), z.literal("")]).optional(),
    scope: z.enum(["all", "category", "products"]),
    category_id: z.string().optional(),
    product_ids: z.array(z.uuid()).max(200),
    starts_at: optDate,
    ends_at: optEndDate,
    active: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (d.kind === "buy_x_get_y" && (!d.buy_qty || !d.get_qty)) ctx.addIssue({ code: "custom", message: "Enter how many to buy and how many are free" });
    if (d.kind === "n_for_price" && (!d.bundle_qty || !d.bundle_price)) ctx.addIssue({ code: "custom", message: "Enter the bundle size and its price" });
    if (d.scope === "category" && !d.category_id) ctx.addIssue({ code: "custom", message: "Pick a category" });
    if (d.scope === "products" && !d.product_ids.length) ctx.addIssue({ code: "custom", message: "Pick at least one product" });
    if (d.starts_at && d.ends_at && d.starts_at >= d.ends_at) ctx.addIssue({ code: "custom", message: "End date must be after start date" });
  });

export type DealInput = z.input<typeof schema>;

export async function saveDeal(input: DealInput): Promise<{ error?: string }> {
  try {
    const { supabase } = await requireAdmin();
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const d = parsed.data;
    const bxgy = d.kind === "buy_x_get_y";
    const row = {
      name: d.name,
      kind: d.kind,
      buy_qty: bxgy ? Number(d.buy_qty) : null,
      get_qty: bxgy ? Number(d.get_qty) : null,
      bundle_qty: bxgy ? null : Number(d.bundle_qty),
      bundle_price: bxgy ? null : Number(d.bundle_price),
      category_id: d.scope === "category" ? d.category_id! : null,
      product_ids: d.scope === "products" ? d.product_ids : [],
      starts_at: d.starts_at,
      ends_at: d.ends_at,
      active: d.active,
    };
    const { error } = d.id ? await supabase.from("deals").update(row).eq("id", d.id) : await supabase.from("deals").insert(row);
    if (error) return { error: error.message };
    revalidatePath("/admin/deals");
    revalidatePath("/", "layout");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteDeal(id: string): Promise<{ error?: string }> {
  try {
    const { supabase } = await requireAdmin();
    // Orders keep the deal's name and discount, so a used deal can still be deleted safely.
    const { error } = await supabase.from("deals").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/admin/deals");
    revalidatePath("/", "layout");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
