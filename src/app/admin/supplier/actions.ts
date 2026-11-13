"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/server";

type Result = { error?: string; count?: number };
const fail = (e: unknown): Result => ({ error: e instanceof Error ? e.message : String(e) });

function refresh() {
  revalidatePath("/admin/supplier");
  revalidatePath("/supplier");
}

/** Mark jobs as paid (or unpaid). A job needs a cost before it can be paid. */
export async function setJobsPaid(ids: string[], paid: boolean): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    const parsed = z.array(z.uuid()).min(1).max(500).safeParse(ids);
    if (!parsed.success) return { error: "Nothing to update" };
    let q = supabase
      .from("print_jobs")
      .update({ paid, paid_at: paid ? new Date().toISOString() : null })
      .in("id", parsed.data);
    if (paid) q = q.not("unit_cost", "is", null);
    const { data, error } = await q.select("id");
    if (error) return { error: error.message };
    if (paid && !data.length) return { error: "Set a cost first, then mark it as paid" };
    refresh();
    return { count: data.length };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteJob(id: string): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    if (!z.uuid().safeParse(id).success) return { error: "Invalid job" };
    const { error } = await supabase.from("print_jobs").delete().eq("id", id);
    if (error) return { error: error.message };
    refresh();
    return {};
  } catch (e) {
    return fail(e);
  }
}

/** Put every item of an order on the print list. Items already there are skipped. */
export async function sendOrderToPrint(orderId: string): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    if (!z.uuid().safeParse(orderId).success) return { error: "Invalid order" };
    const { data, error } = await supabase.rpc("admin_send_order_to_print", { p_order: orderId });
    if (error) return { error: /cancelled|not found/i.test(error.message) ? error.message : "Couldn't send that order to print" };
    refresh();
    revalidatePath("/admin/orders");
    return { count: data ?? 0 };
  } catch (e) {
    return fail(e);
  }
}

const jobSchema = z.object({
  /** A product option from the shop. When given, the name, option and photo come from the product. */
  variantId: z.uuid().optional(),
  title: z.string().trim().min(2, "Enter what should be printed").max(200),
  variant: z.string().trim().max(200).optional(),
  details: z.string().trim().max(500).optional(),
  quantity: z.number().int().min(1, "Quantity must be at least 1").max(9999),
  unitCost: z.number().min(0).max(1_000_000).optional(),
});

/** Add a job by hand, e.g. for a custom request or stock you want printed. */
export async function addJob(input: z.input<typeof jobSchema>): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    const parsed = jobSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const j = parsed.data;
    let image: string | null = null;
    if (j.variantId) {
      const { data: v } = await supabase.from("product_variants").select("options, products(name, images)").eq("id", j.variantId).single();
      if (!v?.products) return { error: "That product option no longer exists" };
      j.title = v.products.name;
      j.variant = Object.values((v.options ?? {}) as Record<string, string>).filter(Boolean).join(" / ");
      image = v.products.images[0] ?? null;
    }
    const { error } = await supabase.from("print_jobs").insert({
      title: j.title,
      image,
      variant: j.variant || null,
      details: j.details || null,
      quantity: j.quantity,
      unit_cost: j.unitCost ?? null,
    });
    if (error) return { error: error.message };
    refresh();
    return {};
  } catch (e) {
    return fail(e);
  }
}

/** Give or remove supplier access for an existing account, found by email. */
export async function setSupplier(email: string, on: boolean): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    const parsed = z.email("Enter a valid email").safeParse(email.trim());
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { error } = await supabase.rpc("admin_set_supplier", { p_email: parsed.data, p_on: on });
    if (error) return { error: /No account|admin/i.test(error.message) ? error.message : "Couldn't update that account" };
    refresh();
    return {};
  } catch (e) {
    return fail(e);
  }
}
