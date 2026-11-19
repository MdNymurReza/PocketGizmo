"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/server";
import { amountDue, smsOrderEvent, type SmsEvent } from "@/lib/sms";
import { consignmentStatus, createConsignment, steadfastConfigured, STEADFAST_STATUS_LABEL } from "@/lib/steadfast";

type Admin = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

const SMS_FOR_STATUS: Partial<Record<string, SmsEvent>> = { confirmed: "confirmed", shipped: "shipped", delivered: "delivered", cancelled: "cancelled" };

/** Texts the customer after the response is sent, so buttons stay fast. */
function textCustomer(supabase: Admin, id: string, status: string) {
  const event = SMS_FOR_STATUS[status];
  if (event) after(() => smsOrderEvent(supabase, id, event));
}

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
    textCustomer(supabase, id, status);
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
      const { error: e } = await supabase.rpc("admin_set_order_status", { p_order: id, p_status: "confirmed", p_note: "Payment verified" });
      if (!e) textCustomer(supabase, id, "confirmed");
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
      textCustomer(supabase, id, "shipped");
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
      const { error: e } = await supabase.rpc("admin_set_order_status", { p_order: id, p_status: "confirmed", p_note: "Delivery charge received" });
      if (!e) textCustomer(supabase, id, "confirmed");
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

/** Books the parcel with Steadfast, saves the tracking code and marks the order as shipped. */
export async function bookSteadfast(id: string): Promise<Result & { tracking?: string; cod?: number }> {
  try {
    const { supabase } = await requireAdmin();
    if (!z.uuid().safeParse(id).success) return { error: "Invalid order" };
    if (!steadfastConfigured()) return { error: "Steadfast is not set up: add STEADFAST_API_KEY and STEADFAST_SECRET_KEY" };
    const { data: o, error } = await supabase
      .from("orders")
      .select("id, order_number, status, customer_name, customer_phone, ship_line, ship_area, ship_district, note, total, payment_status, advance_amount, advance_status, consignment_id, gift_wrap, order_items(product_name, quantity)")
      .eq("id", id)
      .single();
    if (error) return { error: error.message };
    if (o.consignment_id) return { error: "This order is already booked with Steadfast" };
    if (!["confirmed", "printing", "shipped"].includes(o.status)) return { error: "Confirm the order before booking a courier" };

    const cod = amountDue(o);
    const items = o.order_items.map((i) => `${i.product_name} x${i.quantity}`).join(", ");
    const consignment = await createConsignment({
      invoice: o.order_number,
      recipient_name: o.customer_name.slice(0, 100),
      recipient_phone: o.customer_phone,
      recipient_address: `${o.ship_line}, ${o.ship_area}, ${o.ship_district}`.slice(0, 250),
      cod_amount: cod,
      item_description: items.slice(0, 200),
      note: [o.gift_wrap ? "Gift wrapped" : "", o.note ?? ""].filter(Boolean).join(". ").slice(0, 200) || undefined,
    });

    const { error: upErr } = await supabase
      .from("orders")
      .update({ courier: "Steadfast", tracking_code: consignment.tracking_code, consignment_id: String(consignment.consignment_id) })
      .eq("id", id);
    if (upErr) return { error: `Booked (tracking ${consignment.tracking_code}) but couldn't save it: ${upErr.message}` };
    if (o.status !== "shipped") {
      const { error: e } = await supabase.rpc("admin_set_order_status", {
        p_order: id,
        p_status: "shipped",
        p_note: `Handed to Steadfast (${consignment.tracking_code})`,
      });
      if (!e) textCustomer(supabase, id, "shipped");
    }
    refresh(id);
    return { tracking: consignment.tracking_code, cod };
  } catch (e) {
    return fail(e);
  }
}

/** Asks Steadfast where the parcel is; marks the order delivered when Steadfast says so. */
export async function refreshCourierStatus(id: string): Promise<Result & { label?: string; delivered?: boolean }> {
  try {
    const { supabase } = await requireAdmin();
    if (!z.uuid().safeParse(id).success) return { error: "Invalid order" };
    if (!steadfastConfigured()) return { error: "Steadfast is not set up" };
    const { data: o, error } = await supabase.from("orders").select("status, consignment_id").eq("id", id).single();
    if (error) return { error: error.message };
    if (!o.consignment_id) return { error: "This order isn't booked with Steadfast" };
    const status = await consignmentStatus(o.consignment_id);
    const label = STEADFAST_STATUS_LABEL[status] ?? status;
    // A partial delivery means some items came back and less cash was collected: the admin settles that by hand.
    if (status === "partial_delivered") return { label: `${label}. Check what was returned, then update the order yourself.` };
    if (status === "delivered" && o.status === "shipped") {
      const { error: e } = await supabase.rpc("admin_set_order_status", { p_order: id, p_status: "delivered", p_note: `Steadfast: ${label}` });
      if (e) return { error: e.message };
      await supabase.from("orders").update({ payment_status: "paid" }).eq("id", id).eq("payment_method", "cod");
      textCustomer(supabase, id, "delivered");
      refresh(id);
      return { label, delivered: true };
    }
    return { label };
  } catch (e) {
    return fail(e);
  }
}
