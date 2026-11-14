"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/server";
import { BD_PHONE_RE, normalizePhone } from "@/lib/bd";

type Result = { error?: string };
const fail = (e: unknown): Result => ({ error: e instanceof Error ? e.message : String(e) });

function refresh() {
  revalidatePath("/admin/stall");
  revalidatePath("/admin/supplier");
  revalidatePath("/supplier");
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const money = z.number().min(0).max(10_000_000);

const orderSchema = z.object({
  customerName: z.string().trim().min(2, "Enter the customer's name").max(120),
  customerPhone: z.string().trim().min(1, "Enter the customer's phone number"),
  stallLocation: z.string().trim().max(120),
  eventDate: z.string().regex(YMD, "Choose the stall date"),
  fulfilment: z.enum(["pickup", "delivery"]),
  deliveryAddress: z.string().trim().max(300),
  deliveryCharge: money,
  discount: money,
  paidAmount: money,
  paymentMethod: z.string().trim().max(40),
  dueDate: z.union([z.string().regex(YMD), z.literal("")]),
  note: z.string().trim().max(500),
  sendToPrint: z.boolean(),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Every item needs a name").max(200),
        details: z.string().trim().max(500),
        quantity: z.number().int().min(1, "Quantity must be at least 1").max(9999),
        unitPrice: z.number().min(0, "Enter a price for every item").max(1_000_000),
      }),
    )
    .min(1, "Add at least one item")
    .max(50),
});

export type StallOrderInput = z.input<typeof orderSchema>;

/** Save an order taken at the stall. The database adds up the prices and gives the order its number. */
export async function createStallOrder(input: StallOrderInput): Promise<Result & { id?: string; orderNumber?: string }> {
  try {
    const { supabase } = await requireAdmin();
    const parsed = orderSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const o = parsed.data;
    const phone = normalizePhone(o.customerPhone);
    if (!BD_PHONE_RE.test(phone)) return { error: "Enter an 11-digit mobile number, e.g. 01712345678" };
    if (o.fulfilment === "delivery" && !o.deliveryAddress) return { error: "Enter the delivery address" };

    const { data, error } = await supabase.rpc("stall_create_order", {
      p: {
        customer_name: o.customerName,
        customer_phone: phone,
        stall_location: o.stallLocation,
        event_date: o.eventDate,
        fulfilment: o.fulfilment,
        delivery_address: o.deliveryAddress,
        delivery_charge: o.deliveryCharge,
        discount: o.discount,
        paid_amount: o.paidAmount,
        payment_method: o.paidAmount > 0 ? o.paymentMethod : "",
        due_date: o.dueDate,
        note: o.note,
        items: o.items.map((i) => ({ name: i.name, details: i.details, quantity: i.quantity, unit_price: i.unitPrice })),
      },
      p_send_to_print: o.sendToPrint,
    });
    if (error) {
      // Messages raised by stall_create_order are written for the person at the stall; hide anything else.
      const known = /enter|add at least|item|quantity|discount|delivery charge|amount paid/i;
      return { error: known.test(error.message) ? error.message : "Couldn't save the order. Please try again." };
    }
    refresh();
    return { id: data.id, orderNumber: data.order_number };
  } catch (e) {
    return fail(e);
  }
}

export async function setStallStatus(id: string, status: "new" | "printing" | "ready" | "delivered" | "cancelled"): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    const parsed = z.object({ id: z.uuid(), status: z.enum(["new", "printing", "ready", "delivered", "cancelled"]) }).safeParse({ id, status });
    if (!parsed.success) return { error: "Invalid order" };
    const { error } = await supabase.rpc("stall_set_status", { p_order: id, p_status: status });
    if (error) return { error: "Couldn't update the order" };
    refresh();
    return {};
  } catch (e) {
    return fail(e);
  }
}

/**
 * Hand an order over in one step, from any open status.
 * With collect, the amount still due is recorded as paid in cash at the same time.
 */
export async function deliverStallOrder(id: string, collect: boolean): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    if (!z.uuid().safeParse(id).success) return { error: "Invalid order" };
    const { data: o } = await supabase.from("stall_orders").select("status, total, paid_amount").eq("id", id).maybeSingle();
    if (!o) return { error: "Order not found" };
    if (o.status === "cancelled") return { error: "This order is cancelled" };
    const due = Math.round((Number(o.total) - Number(o.paid_amount)) * 100) / 100;
    if (collect && due > 0) {
      const { error } = await supabase.rpc("stall_record_payment", { p_order: id, p_amount: due, p_method: "Cash" });
      if (error) return { error: "Couldn't save the payment" };
    }
    const { error } = await supabase.rpc("stall_set_status", { p_order: id, p_status: "delivered" });
    if (error) return { error: "Couldn't mark the order as delivered" };
    refresh();
    return {};
  } catch (e) {
    return fail(e);
  }
}

/** Add money the customer paid. A negative amount corrects a mistake. */
export async function recordStallPayment(id: string, amount: number, method: string): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    const parsed = z.object({ id: z.uuid(), amount: z.number().min(-10_000_000).max(10_000_000), method: z.string().max(40) }).safeParse({ id, amount, method });
    if (!parsed.success || amount === 0) return { error: "Enter an amount" };
    const { error } = await supabase.rpc("stall_record_payment", { p_order: id, p_amount: amount, p_method: method });
    if (error) return { error: /more than|below zero/i.test(error.message) ? error.message : "Couldn't save the payment" };
    refresh();
    return {};
  } catch (e) {
    return fail(e);
  }
}

/** Remove an order that was entered by mistake, with its print jobs that are not paid for. */
export async function deleteStallOrder(id: string): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    if (!z.uuid().safeParse(id).success) return { error: "Invalid order" };
    const { error: jobError } = await supabase.from("print_jobs").delete().eq("stall_order_id", id).eq("paid", false);
    if (jobError) return { error: "Couldn't delete the order" };
    const { error } = await supabase.from("stall_orders").delete().eq("id", id);
    if (error) return { error: "Couldn't delete the order" };
    refresh();
    return {};
  } catch (e) {
    return fail(e);
  }
}
