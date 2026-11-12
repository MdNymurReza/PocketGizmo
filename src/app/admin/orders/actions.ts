"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/server";

type Result = { error?: string };

const fail = (e: unknown): Result => ({ error: e instanceof Error ? e.message : String(e) });

function refresh(id: string) {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin");
  revalidatePath("/admin/inventory");
}

const statusSchema = z.object({
  id: z.uuid(),
  status: z.enum(["pending", "confirmed", "printing", "shipped", "delivered", "cancelled"]),
  note: z.string().max(300).default(""),
});

export async function setOrderStatus(input: z.input<typeof statusSchema>): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    const { id, status, note } = statusSchema.parse(input);
    const { error } = await supabase.rpc("admin_set_order_status", { p_order: id, p_status: status, p_note: note });
    if (error) return { error: error.message };
    // Cash on delivery is collected on delivery.
    if (status === "delivered") {
      await supabase.from("orders").update({ payment_status: "paid" }).eq("id", id).eq("payment_method", "cod");
    }
    refresh(id);
    return {};
  } catch (e) {
    return fail(e);
  }
}

export async function setPaymentStatus(id: string, verdict: "paid" | "rejected" | "refunded"): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    const { data: order, error: readErr } = await supabase.from("orders").select("status, payment_status").eq("id", id).single();
    if (readErr) return { error: readErr.message };
    const { error } = await supabase.from("orders").update({ payment_status: verdict }).eq("id", id);
    if (error) return { error: error.message };
    // A verified payment confirms a pending order automatically.
    if (verdict === "paid" && order.status === "pending") {
      await supabase.rpc("admin_set_order_status", { p_order: id, p_status: "confirmed", p_note: "Payment verified" });
    }
    refresh(id);
    return {};
  } catch (e) {
    return fail(e);
  }
}

const shippingSchema = z.object({
  id: z.uuid(),
  courier: z.string().trim().max(60),
  tracking_code: z.string().trim().max(80),
  markShipped: z.boolean().default(false),
});

export async function saveShipping(input: z.input<typeof shippingSchema>): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    const { id, courier, tracking_code, markShipped } = shippingSchema.parse(input);
    const { error } = await supabase
      .from("orders")
      .update({ courier: courier || null, tracking_code: tracking_code || null })
      .eq("id", id);
    if (error) return { error: error.message };
    if (markShipped) {
      const note = courier ? `Handed to ${courier}${tracking_code ? ` (${tracking_code})` : ""}` : "";
      const { error: e } = await supabase.rpc("admin_set_order_status", { p_order: id, p_status: "shipped", p_note: note });
      if (e) return { error: e.message };
    }
    refresh(id);
    return {};
  } catch (e) {
    return fail(e);
  }
}

export async function setAdvanceStatus(id: string, verdict: "verified" | "rejected"): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    const { data: order, error: readErr } = await supabase.from("orders").select("status, advance_status").eq("id", id).single();
    if (readErr) return { error: readErr.message };
    if (order.advance_status === "none") return { error: "This order has no advance payment" };
    const { error } = await supabase.from("orders").update({ advance_status: verdict }).eq("id", id);
    if (error) return { error: error.message };
    // A received delivery charge confirms a pending COD order automatically.
    if (verdict === "verified" && order.status === "pending") {
      await supabase.rpc("admin_set_order_status", { p_order: id, p_status: "confirmed", p_note: "Delivery charge received" });
    }
    refresh(id);
    return {};
  } catch (e) {
    return fail(e);
  }
}

const blockSchema = z.object({
  phone: z.string().trim().min(10),
  reason: z.string().trim().max(200).default(""),
  orderId: z.uuid().optional(),
});

/** Block or unblock a phone number from placing online orders. */
export async function setPhoneBlocked(input: z.input<typeof blockSchema>, blocked: boolean): Promise<Result> {
  try {
    const { supabase, user } = await requireAdmin();
    const { phone, reason, orderId } = blockSchema.parse(input);
    const key = phone.replace(/\D/g, "").slice(-10);
    if (key.length !== 10) return { error: "Invalid phone number" };
    const { error } = blocked
      ? await supabase.from("blocked_phones").upsert({ phone: key, reason: reason || null, created_by: user?.id ?? null })
      : await supabase.from("blocked_phones").delete().eq("phone", key);
    if (error) return { error: error.message };
    if (orderId) refresh(orderId);
    revalidatePath("/admin/orders");
    return {};
  } catch (e) {
    return fail(e);
  }
}
