import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionProfile } from "@/lib/supabase/server";
import { BD_PHONE_RE, normalizePhone } from "@/lib/bd";

export const dynamic = "force-dynamic";

const money = z.number().min(0).max(10_000_000);

const orderSchema = z.object({
  clientId: z.uuid(),
  orderNumber: z.string().max(20),
  createdAt: z.string().max(40),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  stallLocation: z.string().max(120),
  customerName: z.string().trim().min(1).max(120),
  customerPhone: z.string().trim().min(1).max(20),
  fulfilment: z.enum(["pickup", "delivery"]),
  deliveryAddress: z.string().max(300),
  deliveryCharge: money,
  discount: money,
  paidAmount: money,
  paymentMethod: z.string().max(40),
  note: z.string().max(500),
  sendToPrint: z.boolean(),
  items: z.array(z.object({ name: z.string().trim().min(1).max(200), details: z.string().max(500), quantity: z.number().int().min(1).max(9999), unitPrice: z.number().min(0).max(1_000_000) })).min(1).max(50),
});

const bodySchema = z.object({
  orders: z.array(z.unknown()).max(500),
  deliveries: z.array(z.object({ orderNumber: z.string().max(20), collect: z.boolean() })).max(500),
});

/**
 * Uploads what a device collected while offline: new orders first, then the orders that were handed over.
 * Every entry gets its own result, so one bad entry does not stop the rest. Repeating an upload is safe.
 */
export async function POST(request: Request) {
  const { supabase, profile } = await getSessionProfile();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Log in as the admin first" }, { status: 401 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "The upload could not be read" }, { status: 400 });

  const orders: { clientId: string; ok: boolean; orderNumber?: string; error?: string }[] = [];
  for (const raw of body.data.orders) {
    const clientId = typeof raw === "object" && raw && "clientId" in raw ? String(raw.clientId) : "";
    const parsed = orderSchema.safeParse(raw);
    if (!parsed.success) {
      orders.push({ clientId, ok: false, error: parsed.error.issues[0].message });
      continue;
    }
    const o = parsed.data;
    const phone = normalizePhone(o.customerPhone);
    const { data, error } = await supabase.rpc("stall_create_order", {
      p: {
        client_id: o.clientId,
        order_number: o.orderNumber,
        created_at: o.createdAt,
        event_date: o.eventDate,
        stall_location: o.stallLocation,
        customer_name: o.customerName,
        // A number typed wrong at the stall is still saved, so the order is not lost.
        customer_phone: BD_PHONE_RE.test(phone) ? phone : o.customerPhone,
        fulfilment: o.fulfilment,
        delivery_address: o.deliveryAddress,
        delivery_charge: o.deliveryCharge,
        discount: o.discount,
        paid_amount: o.paidAmount,
        payment_method: o.paidAmount > 0 ? o.paymentMethod : "",
        due_date: "",
        note: o.note,
        items: o.items.map((i) => ({ name: i.name, details: i.details, quantity: i.quantity, unit_price: i.unitPrice })),
      },
      p_send_to_print: o.sendToPrint,
    });
    if (error) orders.push({ clientId: o.clientId, ok: false, error: error.message });
    else orders.push({ clientId: o.clientId, ok: true, orderNumber: data.order_number });
  }

  // An order that got another number during upload is found under its new number.
  const renamed = new Map<string, string>();
  body.data.orders.forEach((raw, i) => {
    const sent = typeof raw === "object" && raw && "orderNumber" in raw ? String(raw.orderNumber).toUpperCase() : "";
    const saved = orders[i]?.orderNumber;
    if (sent && saved && saved !== sent) renamed.set(sent, saved);
  });

  const deliveries: { orderNumber: string; ok: boolean; error?: string }[] = [];
  for (const d of body.data.deliveries) {
    const number = renamed.get(d.orderNumber.toUpperCase()) ?? d.orderNumber.toUpperCase();
    const { data: o } = await supabase.from("stall_orders").select("id, status, total, paid_amount").eq("order_number", number).maybeSingle();
    if (!o) {
      deliveries.push({ orderNumber: d.orderNumber, ok: false, error: "Order not found" });
      continue;
    }
    if (o.status === "cancelled") {
      deliveries.push({ orderNumber: d.orderNumber, ok: false, error: "This order was cancelled" });
      continue;
    }
    const due = Math.round((Number(o.total) - Number(o.paid_amount)) * 100) / 100;
    let failed = "";
    if (d.collect && due > 0) {
      const { error } = await supabase.rpc("stall_record_payment", { p_order: o.id, p_amount: due, p_method: "Cash" });
      if (error) failed = "Couldn't save the payment";
    }
    if (!failed && o.status !== "delivered") {
      const { error } = await supabase.rpc("stall_set_status", { p_order: o.id, p_status: "delivered" });
      if (error) failed = "Couldn't mark the order as delivered";
    }
    deliveries.push(failed ? { orderNumber: d.orderNumber, ok: false, error: failed } : { orderNumber: d.orderNumber, ok: true });
  }

  revalidatePath("/admin/stall");
  revalidatePath("/admin/supplier");
  revalidatePath("/supplier");
  return NextResponse.json({ orders, deliveries });
}
