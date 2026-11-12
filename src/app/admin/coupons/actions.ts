"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/server";

const optNum = z.union([z.coerce.number().min(0), z.literal(""), z.null()]).optional().transform((v) => (v === "" || v == null ? null : Number(v)));
const optInt = z.union([z.coerce.number().int().min(1), z.literal(""), z.null()]).optional().transform((v) => (v === "" || v == null ? null : Number(v)));
const optDate = z.string().optional().transform((v) => (v ? new Date(`${v}T00:00:00+06:00`).toISOString() : null));
const optEndDate = z.string().optional().transform((v) => (v ? new Date(`${v}T23:59:59+06:00`).toISOString() : null));

const schema = z
  .object({
    id: z.uuid().optional(),
    code: z.string().trim().min(3, "Code must be at least 3 characters").max(30).regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, - or _ only"),
    type: z.enum(["percent", "fixed"]),
    value: z.coerce.number().positive("Enter a discount value"),
    min_order: z.coerce.number().min(0).default(0),
    max_discount: optNum,
    usage_limit: optInt,
    per_user_limit: optInt,
    starts_at: optDate,
    ends_at: optEndDate,
    active: z.boolean(),
  })
  .refine((c) => c.type !== "percent" || c.value <= 100, { message: "Percentage can't exceed 100", path: ["value"] })
  .refine((c) => !c.starts_at || !c.ends_at || c.starts_at < c.ends_at, { message: "End date must be after start date", path: ["ends_at"] });

export type CouponInput = z.input<typeof schema>;

export async function saveCoupon(input: CouponInput): Promise<{ error?: string }> {
  try {
    const { supabase } = await requireAdmin();
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { id, ...row } = parsed.data;
    const data = { ...row, code: row.code.toUpperCase() };
    const { error } = id ? await supabase.from("coupons").update(data).eq("id", id) : await supabase.from("coupons").insert(data);
    if (error) return { error: error.message.includes("duplicate") ? "A coupon with that code already exists" : error.message };
    revalidatePath("/admin/coupons");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteCoupon(id: string): Promise<{ error?: string }> {
  try {
    const { supabase } = await requireAdmin();
    const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("coupon_id", id);
    // Keep used coupons for reporting; just switch them off.
    const { error } = count
      ? await supabase.from("coupons").update({ active: false }).eq("id", id)
      : await supabase.from("coupons").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/admin/coupons");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
