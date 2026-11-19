"use server";

import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { BD_PHONE_RE, normalizePhone } from "@/lib/bd";
import { CAPTCHA_ERROR, verifyCaptcha } from "@/lib/turnstile";
import { esc, notifyAdmin, siteUrl } from "@/lib/notify";
import { PAYMENT_LABEL, formatBDT } from "@/lib/utils";
import { smsOrderPlaced } from "@/lib/sms";

const itemsSchema = z
  .array(z.object({ variant_id: z.uuid(), quantity: z.number().int().min(1).max(99), details: z.string().trim().max(300).optional() }))
  .min(1, "Your cart is empty")
  .max(50);

/** Subtotal from current database prices (never trust client prices). */
async function serverSubtotal(items: z.infer<typeof itemsSchema>) {
  const supabase = await createClient();
  const { data } = await supabase.from("product_variants").select("id, price").in("id", items.map((i) => i.variant_id));
  const price = new Map((data ?? []).map((v) => [v.id, Number(v.price)]));
  return { supabase, subtotal: items.reduce((n, i) => n + (price.get(i.variant_id) ?? 0) * i.quantity, 0) };
}

export async function checkCoupon(code: string, rawItems: unknown): Promise<{ discount?: number; error?: string }> {
  const items = itemsSchema.safeParse(rawItems);
  if (!items.success) return { error: "Your cart is empty" };
  if (!code.trim()) return { error: "Enter a coupon code" };
  const { supabase, subtotal } = await serverSubtotal(items.data);
  const { data, error } = await supabase.rpc("validate_coupon", { p_code: code.trim(), p_subtotal: subtotal });
  if (error) return { error: "Couldn't check that coupon, please try again" };
  const row = data?.[0];
  if (!row || row.error) return { error: row?.error ?? "Invalid coupon code" };
  return { discount: Number(row.discount) };
}

const orderSchema = z
  .object({
    items: itemsSchema,
    name: z.string().trim().min(2, "Enter your full name").max(80),
    phone: z.string().trim().regex(BD_PHONE_RE, "Enter a valid mobile number (01XXXXXXXXX)"),
    email: z.union([z.email("Enter a valid email"), z.literal("")]).optional(),
    district: z.string().trim().min(2, "Select your district"),
    area: z.string().trim().min(2, "Enter your area / thana").max(80),
    line: z.string().trim().min(5, "Enter your full address").max(250),
    zone: z.enum(["inside_dhaka", "outside_dhaka"]),
    note: z.string().max(500).optional(),
    coupon: z.string().max(40).optional(),
    points: z.number().int().min(0).max(1_000_000).optional(),
    giftWrap: z.boolean().optional(),
    giftMessage: z.string().max(200).optional(),
    giftHidePrices: z.boolean().optional(),
    payment: z.enum(["cod", "bkash", "nagad", "rocket"]),
    /** Wallet used to pay the delivery charge in advance on a COD order. */
    advance: z.enum(["bkash", "nagad", "rocket"]).optional(),
    sender: z.string().trim().optional(),
    trx: z.string().trim().optional(),
    saveAddress: z.boolean().optional(),
    captcha: z.string().max(4096).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.payment === "cod" && !v.advance) return;
    if (!v.sender || !BD_PHONE_RE.test(v.sender))
      ctx.addIssue({ code: "custom", path: ["sender"], message: "Enter the number you sent money from" });
    if (!v.trx || !/^[A-Za-z0-9]{6,20}$/.test(v.trx))
      ctx.addIssue({ code: "custom", path: ["trx"], message: "Enter a valid Transaction ID" });
  });

export type OrderInput = z.input<typeof orderSchema>;
export type OrderResult =
  | { ok: true; orderNumber: string; token: string }
  | { ok: false; error: string; field?: string };

export async function placeOrder(input: OrderInput): Promise<OrderResult> {
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue.message, field: issue.path.join(".") };
  }
  const o = parsed.data;
  if (!(await verifyCaptcha(o.captcha))) return { ok: false, error: CAPTCHA_ERROR };
  const supabase = await createClient();
  const usesWallet = o.payment !== "cod" || Boolean(o.advance);

  const { data, error } = await supabase.rpc("place_order", {
    p_items: o.items,
    p_customer_name: o.name,
    p_customer_phone: normalizePhone(o.phone),
    p_customer_email: o.email ?? "",
    p_district: o.district,
    p_area: o.area,
    p_line: o.line,
    p_zone: o.zone,
    p_note: o.note ?? "",
    p_coupon_code: o.coupon ?? "",
    p_payment_method: o.payment,
    p_sender_number: usesWallet ? normalizePhone(o.sender ?? "") : "",
    p_trx_id: usesWallet ? (o.trx ?? "") : "",
    p_advance_method: o.payment === "cod" ? o.advance : undefined,
    p_points: o.points ?? 0,
    p_gift_wrap: o.giftWrap ?? false,
    p_gift_message: o.giftMessage ?? "",
    p_gift_hide_prices: o.giftHidePrices ?? false,
  });
  if (error) {
    // Messages raised by place_order are written for customers; hide anything else.
    const known = /cart|available|Only \d+ left|coupon|Minimum order|expired|usage limit|Transaction ID|required|quantity|delivery charge|this number|points/i;
    return { ok: false, error: known.test(error.message) ? error.message : "Something went wrong placing your order. Please try again." };
  }
  const row = data?.[0];
  if (!row) return { ok: false, error: "Something went wrong placing your order. Please try again." };

  // Optionally remember the address for signed-in customers (best effort).
  if (o.saveAddress) {
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      const { count } = await supabase.from("addresses").select("id", { count: "exact", head: true }).eq("user_id", auth.user.id);
      await supabase.from("addresses").insert({
        user_id: auth.user.id,
        name: o.name,
        phone: normalizePhone(o.phone),
        district: o.district,
        area: o.area,
        line: o.line,
        zone: o.zone,
        is_default: !count,
      });
    }
  }

  // Alert the store owner after the response is sent, so checkout stays fast.
  after(() => notifyNewOrder(row.order_number, o));
  after(async () => {
    const { data: tracked } = await supabase.rpc("track_order", { p_order_number: row.order_number, p_phone: "", p_token: row.tracking_token });
    const total = Number((tracked as { total?: number } | null)?.total ?? 0);
    await smsOrderPlaced(supabase, row.tracking_token, { order_number: row.order_number, customer_phone: normalizePhone(o.phone), total });
  });

  return { ok: true, orderNumber: row.order_number, token: row.tracking_token };
}

async function notifyNewOrder(orderNumber: string, o: z.infer<typeof orderSchema>) {
  const supabase = await createClient();
  const { data: variants } = await supabase
    .from("product_variants")
    .select("id, price, products(name)")
    .in("id", o.items.map((i) => i.variant_id));
  const byId = new Map((variants ?? []).map((v) => [v.id, v]));
  const lines = o.items.map((i) => {
    const v = byId.get(i.variant_id);
    return `• ${esc(v?.products?.name ?? "Item")} × ${i.quantity}${i.details ? `\n   ✏️ ${esc(i.details)}` : ""}`;
  });
  const subtotal = o.items.reduce((n, i) => n + Number(byId.get(i.variant_id)?.price ?? 0) * i.quantity, 0);

  const pay =
    o.payment !== "cod"
      ? `💳 ${PAYMENT_LABEL[o.payment]}: <b>verify TrxID</b> <code>${esc((o.trx ?? "").toUpperCase())}</code> from ${esc(o.sender)}`
      : o.advance
        ? `💵 COD, delivery charge paid by ${PAYMENT_LABEL[o.advance]}: <b>verify TrxID</b> <code>${esc((o.trx ?? "").toUpperCase())}</code>`
        : "💵 Cash on delivery";

  await notifyAdmin(
    [
      `🛒 <b>New order ${esc(orderNumber)}</b>`,
      `${esc(o.name)} · ${esc(normalizePhone(o.phone))}`,
      `${esc(o.area)}, ${esc(o.district)}`,
      "",
      ...lines,
      `Items: ${formatBDT(subtotal)}${o.coupon ? ` (coupon ${esc(o.coupon.toUpperCase())})` : ""}`,
      pay,
      "",
      `<a href="${siteUrl(`/admin/orders?q=${encodeURIComponent(orderNumber)}`)}">Open in admin</a>`,
    ].join("\n"),
  );
}
