import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { siteUrl } from "@/lib/notify";

type Client = SupabaseClient<Database>;

export const SMS_EVENTS = [
  { key: "placed", label: "Order placed" },
  { key: "confirmed", label: "Order confirmed" },
  { key: "shipped", label: "Order shipped" },
  { key: "delivered", label: "Order delivered" },
  { key: "cancelled", label: "Order cancelled" },
  { key: "back_in_stock", label: "Back in stock" },
] as const;
export type SmsEvent = (typeof SMS_EVENTS)[number]["key"];

export const smsConfigured = () => Boolean(process.env.BULKSMSBD_API_KEY && process.env.BULKSMSBD_SENDER_ID);

const BULKSMSBD_ERRORS: Record<number, string> = {
  1001: "Invalid number",
  1002: "Sender ID not correct or disabled",
  1003: "Required fields missing",
  1005: "Internal error at BulkSMSBD",
  1006: "Balance validity not available",
  1007: "Insufficient SMS balance",
  1011: "User ID not found",
  1012: "Masking SMS must be sent in Bengali",
  1013: "Sender ID not found for this API key",
  1031: "BulkSMSBD account not verified",
  1032: "Server IP not whitelisted at BulkSMSBD",
};

/**
 * Sends one SMS through BulkSMSBD. Never throws, so a failed SMS can't break an order.
 * Needs BULKSMSBD_API_KEY and BULKSMSBD_SENDER_ID.
 */
export async function sendSms(phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.BULKSMSBD_API_KEY;
  const senderId = process.env.BULKSMSBD_SENDER_ID;
  if (!apiKey || !senderId) return { ok: false, error: "SMS is not set up" };
  const digits = phone.replace(/\D/g, "").slice(-11);
  if (!/^01[3-9]\d{8}$/.test(digits)) return { ok: false, error: "Invalid number" };
  try {
    const res = await fetch("https://bulksmsbd.net/api/smsapi", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ api_key: apiKey, senderid: senderId, number: `88${digits}`, message, type: "text" }),
      signal: AbortSignal.timeout(10000),
    });
    const data = (await res.json().catch(() => null)) as { response_code?: number | string; error_message?: string } | null;
    const code = Number(data?.response_code);
    if (code === 202) return { ok: true };
    return { ok: false, error: BULKSMSBD_ERRORS[code] ?? data?.error_message ?? `BulkSMSBD error ${data?.response_code ?? res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "SMS request failed" };
  }
}

type SmsSettings = { store_name: string; sms_enabled: boolean; sms_events: string[]; contact_phone: string | null };

async function smsSettings(supabase: Client): Promise<SmsSettings | null> {
  const { data } = await supabase.from("settings").select("store_name, sms_enabled, sms_events, contact_phone").eq("id", 1).single();
  return data;
}

const tk = (n: number) => `Tk${Math.round(n).toLocaleString("en-US")}`;

type OrderForSms = {
  id: string; order_number: string; customer_phone: string; total: number; courier: string | null; tracking_code: string | null;
  payment_method: string; payment_status: string; advance_amount: number; advance_status: string;
};

/** What is left to pay on delivery. */
export function amountDue(o: Pick<OrderForSms, "total" | "payment_status" | "advance_amount" | "advance_status">) {
  if (o.payment_status === "paid") return 0;
  return Math.max(0, Number(o.total) - (o.advance_status === "verified" ? Number(o.advance_amount) : 0));
}

function orderMessage(event: SmsEvent, o: OrderForSms, s: SmsSettings) {
  const name = s.store_name || "PocketGizmo";
  const n = o.order_number;
  switch (event) {
    case "placed":
      return `${name}: We got your order ${n} (${tk(o.total)}). We'll confirm it soon. Track: ${siteUrl("/track")}`;
    case "confirmed":
      return `${name}: Your order ${n} is confirmed and will be printed soon. Thank you!`;
    case "shipped": {
      const due = amountDue(o);
      const via = o.courier ? ` with ${o.courier}` : "";
      const code = o.tracking_code ? ` Tracking: ${o.tracking_code}.` : "";
      return `${name}: Order ${n} is on the way${via}.${code}${due > 0 ? ` Please keep ${tk(due)} ready.` : ""}`;
    }
    case "delivered":
      return `${name}: Order ${n} delivered. Thank you! Review it to earn points: ${siteUrl("/account/orders")}`;
    case "cancelled":
      return `${name}: Your order ${n} has been cancelled.${s.contact_phone ? ` Questions? Call ${s.contact_phone}.` : ""}`;
    default:
      return "";
  }
}

const enabled = (s: SmsSettings | null, event: SmsEvent) => Boolean(s?.sms_enabled && s.sms_events.includes(event) && smsConfigured());

/**
 * Texts the customer about an order event and records it in the SMS log.
 * Call with the admin's client (status changes); errors are logged, never thrown.
 */
export async function smsOrderEvent(supabase: Client, orderId: string, event: SmsEvent) {
  try {
    const s = await smsSettings(supabase);
    if (!enabled(s, event)) return;
    const { data: o } = await supabase
      .from("orders")
      .select("id, order_number, customer_phone, total, courier, tracking_code, payment_method, payment_status, advance_amount, advance_status")
      .eq("id", orderId)
      .single();
    if (!o) return;
    // One message per event per order, so pressing a button twice doesn't text twice.
    const { count } = await supabase.from("sms_log").select("id", { count: "exact", head: true }).eq("order_id", orderId).eq("event", event).eq("ok", true);
    if (count) return;
    const message = orderMessage(event, o, s!);
    const res = await sendSms(o.customer_phone, message);
    await supabase.from("sms_log").insert({ phone: o.customer_phone, event, order_id: orderId, message, ok: res.ok, error: res.error ?? null });
  } catch (e) {
    console.error("Order SMS failed", e);
  }
}

/** The "order placed" text, sent from checkout where the customer may not be logged in. */
export async function smsOrderPlaced(supabase: Client, token: string, o: { order_number: string; customer_phone: string; total: number }) {
  try {
    const s = await smsSettings(supabase);
    if (!enabled(s, "placed")) return;
    const message = orderMessage("placed", { ...o, id: "", courier: null, tracking_code: null, payment_method: "", payment_status: "", advance_amount: 0, advance_status: "none" }, s!);
    const res = await sendSms(o.customer_phone, message);
    await supabase.rpc("log_order_sms", { p_token: token, p_phone: o.customer_phone, p_message: message, p_ok: res.ok, p_error: res.error ?? "" });
  } catch (e) {
    console.error("Order placed SMS failed", e);
  }
}

/**
 * Texts everyone waiting for items that now have stock, then marks them as told.
 * Call with the admin's client after stock goes up.
 */
export async function sendBackInStockAlerts(supabase: Client, variantIds?: string[]) {
  try {
    let q = supabase
      .from("stock_alerts")
      .select("id, phone, variant_id, product_variants!inner(stock, is_active, products!inner(name, slug, is_active))")
      .is("notified_at", null)
      .gt("product_variants.stock", 0)
      .limit(200);
    if (variantIds?.length) q = q.in("variant_id", variantIds);
    const { data: alerts } = await q;
    if (!alerts?.length) return 0;
    const s = await smsSettings(supabase);
    const canText = enabled(s, "back_in_stock");
    let sent = 0;
    for (const a of alerts) {
      const p = a.product_variants.products;
      if (!a.product_variants.is_active || !p.is_active) continue;
      if (canText) {
        const message = `${s!.store_name || "PocketGizmo"}: ${p.name} is back in stock. Order now: ${siteUrl(`/product/${p.slug}`)}`;
        const res = await sendSms(a.phone, message);
        await supabase.from("sms_log").insert({ phone: a.phone, event: "back_in_stock", message, ok: res.ok, error: res.error ?? null });
        if (!res.ok) continue;
        sent++;
      }
      // Without SMS the alert stays waiting, so the admin can still see who to contact.
      if (canText) await supabase.from("stock_alerts").update({ notified_at: new Date().toISOString() }).eq("id", a.id);
    }
    return sent;
  } catch (e) {
    console.error("Back-in-stock alerts failed", e);
    return 0;
  }
}
