import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { BD_PHONE_RE, normalizePhone } from "@/lib/bd";
import { getStoreSettings } from "@/lib/store-settings";
import type { TrackedOrder } from "@/lib/orders";
import { PAYMENT_STATUS_LABEL } from "@/lib/orders";
import { PAYMENT_LABEL, variantLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The built-in PDF fonts only cover Latin characters, so emoji and other scripts are left out. */
const clean = (s: string | null | undefined) =>
  String(s ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/৳/g, "Tk ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");

const tk = (n: number) => `Tk ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const ink = rgb(0.09, 0.09, 0.11);
const soft = rgb(0.42, 0.43, 0.47);
const line = rgb(0.88, 0.88, 0.9);
const accent = rgb(0.49, 0.23, 0.93);

/**
 * The customer's receipt as a PDF. Opened with the order's tracking token (?t=) or the phone number used (?p=).
 * ?gift=1 leaves out every price, for a slip that goes inside a gift.
 */
export async function GET(request: Request, { params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const url = new URL(request.url);
  const token = url.searchParams.get("t");
  const phone = normalizePhone(url.searchParams.get("p") ?? "");
  if (!(token && UUID_RE.test(token)) && !BD_PHONE_RE.test(phone)) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const { data } = await supabase.rpc("track_order", {
    p_order_number: number,
    p_phone: token ? "" : phone,
    p_token: (token && UUID_RE.test(token) ? token : null) as unknown as string,
  });
  if (!data) return new NextResponse("Not found", { status: 404 });
  const order = data as unknown as TrackedOrder;
  const store = await getStoreSettings();
  const gift = url.searchParams.get("gift") === "1";

  const pdf = await PDFDocument.create();
  pdf.setTitle(`${gift ? "Gift receipt" : "Receipt"} ${order.order_number}`);
  pdf.setAuthor(store.storeName);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const W = 595.28; // A4
  const H = 841.89;
  const M = 48;
  let page = pdf.addPage([W, H]);
  let y = H - M;

  const text = (p: PDFPage, s: string, x: number, yy: number, o: { size?: number; f?: PDFFont; color?: typeof ink; right?: boolean } = {}) => {
    const size = o.size ?? 10;
    const f = o.f ?? font;
    const str = clean(s);
    const w = f.widthOfTextAtSize(str, size);
    p.drawText(str, { x: o.right ? x - w : x, y: yy, size, font: f, color: o.color ?? ink });
  };
  /** Splits text into lines that fit the width. */
  const wrap = (s: string, width: number, size = 10, f = font) => {
    const words = clean(s).split(/\s+/);
    const out: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) > width && cur) {
        out.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) out.push(cur);
    return out;
  };
  const ensure = (needed: number) => {
    if (y - needed < M + 40) {
      page = pdf.addPage([W, H]);
      y = H - M;
    }
  };

  // Header
  text(page, store.storeName, M, y - 6, { size: 20, f: bold, color: accent });
  text(page, gift ? "GIFT RECEIPT" : "RECEIPT", W - M, y - 4, { size: 12, f: bold, right: true });
  y -= 24;
  const contact = [store.phone, store.email].filter(Boolean).join("  ·  ");
  if (contact) text(page, contact, M, y, { size: 9, color: soft });
  text(page, `Order ${order.order_number}`, W - M, y, { size: 10, f: bold, right: true });
  y -= 14;
  text(page, new Date(order.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" }), W - M, y, { size: 9, color: soft, right: true });
  y -= 20;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: line });
  y -= 22;

  // Customer and payment
  text(page, "DELIVER TO", M, y, { size: 8, f: bold, color: soft });
  if (!gift) text(page, "PAYMENT", W / 2 + 20, y, { size: 8, f: bold, color: soft });
  y -= 14;
  text(page, order.customer_name, M, y, { size: 11, f: bold });
  if (!gift) text(page, PAYMENT_LABEL[order.payment_method], W / 2 + 20, y, { size: 11, f: bold });
  y -= 14;
  text(page, `${order.ship_area}, ${order.ship_district}`, M, y, { color: soft });
  if (!gift) text(page, PAYMENT_STATUS_LABEL[order.payment_status], W / 2 + 20, y, { color: soft });
  y -= 30;

  // Items table
  const cols = gift ? { qty: W - M } : { qty: W - M - 170, unit: W - M - 90, total: W - M };
  const nameWidth = (gift ? W - M - 60 : cols.qty - 40) - M;
  page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 20, color: rgb(0.96, 0.96, 0.97) });
  text(page, "Item", M + 8, y, { size: 9, f: bold });
  text(page, "Qty", cols.qty - (gift ? 8 : 0), y, { size: 9, f: bold, right: true });
  if (!gift) {
    text(page, "Price", cols.unit!, y, { size: 9, f: bold, right: true });
    text(page, "Total", cols.total! - 8, y, { size: 9, f: bold, right: true });
  }
  y -= 24;

  for (const it of order.items) {
    const nameLines = wrap(it.name, nameWidth, 10, bold);
    const extra = [variantLabel(it.options), it.details ? `Details: ${it.details}` : "", it.preorder_qty ? `Pre-order: ${it.preorder_qty}` : ""]
      .filter(Boolean)
      .flatMap((s) => wrap(s, nameWidth, 9));
    ensure((nameLines.length + extra.length) * 13 + 10);
    const top = y;
    nameLines.forEach((l, i) => text(page, l, M + 8, top - i * 13, { f: bold }));
    extra.forEach((l, i) => text(page, l, M + 8, top - (nameLines.length + i) * 13, { size: 9, color: soft }));
    text(page, String(it.quantity), cols.qty - (gift ? 8 : 0), top, { right: true });
    if (!gift) {
      text(page, tk(it.unit_price), cols.unit!, top, { right: true });
      text(page, tk(it.line_total), cols.total! - 8, top, { right: true });
    }
    y = top - (nameLines.length + extra.length) * 13 - 8;
    page.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 0.5, color: line });
    y -= 8;
  }

  // Totals
  if (!gift) {
    const rows: [string, string][] = [["Subtotal", tk(order.subtotal)]];
    if (Number(order.deal_discount) > 0) rows.push([`Deal${order.deal_name ? `: ${order.deal_name}` : ""}`, `-${tk(Number(order.deal_discount))}`]);
    if (Number(order.discount) > 0) rows.push([`Coupon${order.coupon_code ? ` ${order.coupon_code}` : ""}`, `-${tk(order.discount)}`]);
    if (Number(order.points_discount) > 0) rows.push([`Points (${order.points_used})`, `-${tk(Number(order.points_discount))}`]);
    if (Number(order.gift_fee) > 0) rows.push(["Gift wrap", tk(Number(order.gift_fee))]);
    rows.push(["Delivery", Number(order.shipping_fee) === 0 ? "Free" : tk(order.shipping_fee)]);
    ensure(rows.length * 16 + 60);
    y -= 6;
    for (const [label, value] of rows) {
      text(page, label, W - M - 200, y, { color: soft });
      text(page, value, W - M - 8, y, { right: true });
      y -= 16;
    }
    page.drawLine({ start: { x: W - M - 200, y: y + 8 }, end: { x: W - M, y: y + 8 }, thickness: 1, color: line });
    y -= 8;
    text(page, "Total", W - M - 200, y, { size: 12, f: bold });
    text(page, tk(order.total), W - M - 8, y, { size: 12, f: bold, right: true });
    y -= 18;
    const advance = order.advance_status === "verified" ? Number(order.advance_amount) : 0;
    const due = order.payment_status === "paid" ? 0 : Math.max(0, Number(order.total) - advance);
    if (advance > 0) {
      text(page, "Paid in advance", W - M - 200, y, { color: soft });
      text(page, tk(advance), W - M - 8, y, { right: true });
      y -= 16;
    }
    text(page, due > 0 ? "To pay on delivery" : "Paid", W - M - 200, y, { f: bold, color: due > 0 ? ink : rgb(0.09, 0.6, 0.35) });
    text(page, tk(due), W - M - 8, y, { f: bold, right: true });
    y -= 24;
  }

  if (order.gift_wrap && order.gift_message) {
    const msg = wrap(`"${order.gift_message}"`, W - 2 * M - 32, 12);
    ensure(msg.length * 16 + 50);
    y -= 10;
    const boxH = msg.length * 16 + 34;
    page.drawRectangle({ x: M, y: y - boxH + 14, width: W - 2 * M, height: boxH, borderColor: accent, borderWidth: 1, color: rgb(0.97, 0.95, 1) });
    text(page, "A GIFT FOR YOU", M + 16, y - 2, { size: 8, f: bold, color: accent });
    msg.forEach((l, i) => text(page, l, M + 16, y - 20 - i * 16, { size: 12 }));
    y -= boxH + 10;
  }

  // Footer on every page
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  for (const p of pdf.getPages()) {
    text(p, `Thank you for shopping with ${store.storeName}!${site ? `  ·  ${site}` : ""}`, W / 2 - font.widthOfTextAtSize(clean(`Thank you for shopping with ${store.storeName}!${site ? `  ·  ${site}` : ""}`), 9) / 2, M - 10, { size: 9, color: soft });
  }

  const bytes = await pdf.save();
  const name = `${gift ? "gift-receipt" : "receipt"}-${order.order_number}.pdf`;
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${url.searchParams.get("download") === "0" ? "inline" : "attachment"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
