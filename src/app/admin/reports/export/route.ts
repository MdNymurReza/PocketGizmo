import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/server";
import { MONTH_RE, getMonthlyReport, monthLabel } from "@/lib/reports";
import { PAYMENT_LABEL, STATUS_LABEL } from "@/lib/utils";

const cell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows: unknown[][]) => "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n"); // BOM so Excel reads it as UTF-8

/** Monthly report as CSV, which Excel and Google Sheets open directly. */
export async function GET(request: Request) {
  let supabase;
  try {
    ({ supabase } = await requireAdmin());
  } catch {
    return new NextResponse("Not allowed", { status: 403 });
  }
  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? "";
  if (!MONTH_RE.test(month)) return new NextResponse("Bad month", { status: 400 });
  const kind = url.searchParams.get("kind") === "summary" ? "summary" : "orders";
  const r = await getMonthlyReport(supabase, month);

  let rows: unknown[][];
  if (kind === "orders") {
    rows = [
      ["Order", "Date", "Customer", "Phone", "District", "Status", "Payment", "Payment status", "Subtotal", "Deal", "Deal discount", "Coupon", "Coupon discount", "Points discount", "Gift wrap", "Delivery", "Total", "Courier", "Tracking"],
      ...r.orders.map((o) => [
        o.order_number,
        new Date(o.created_at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" }),
        o.customer_name,
        o.customer_phone,
        o.ship_district,
        STATUS_LABEL[o.status],
        PAYMENT_LABEL[o.payment_method],
        o.payment_status,
        o.subtotal,
        o.deal_name ?? "",
        o.deal_discount,
        o.coupon_code ?? "",
        o.discount,
        o.points_discount,
        o.gift_fee,
        o.shipping_fee,
        o.total,
        o.courier ?? "",
        o.tracking_code ?? "",
      ]),
    ];
  } else {
    const t = r.sales.totals;
    const st = r.stall?.totals;
    rows = [
      [`PocketGizmo report: ${monthLabel(month)}`],
      [],
      ["Online orders (not cancelled)", t.orders],
      ["Online sales", t.revenue],
      ["Average order", t.aov],
      ["Cancelled orders", r.sales.cancelled],
      ["Deal discounts", r.discounts.deals],
      ["Coupon discounts", r.discounts.coupons],
      ["Paid with points", r.discounts.points],
      ["Gift wrap charges", r.giftFees],
      ["Delivery charges", r.shipping],
      ["Online print cost", r.profit?.cost ?? 0],
      ["Online profit", r.profit?.profit ?? 0],
      ["Online orders without print cost", r.profit?.uncounted_orders ?? 0],
      [],
      ["Stall orders", st?.orders ?? 0],
      ["Stall sales", st?.revenue ?? 0],
      ["Stall collected", st?.collected ?? 0],
      ["Stall due", st?.due ?? 0],
      ["Stall print cost", r.stall?.print_cost ?? 0],
      [],
      ["Paid to supplier", r.supplierPaid],
      ["Print jobs settled", r.supplierJobs],
      ["Points earned", r.points.earned],
      ["Points used", r.points.used],
      [],
      ["Payment method", "Orders", "Sales"],
      ...r.sales.by_payment.map((p) => [PAYMENT_LABEL[p.method as keyof typeof PAYMENT_LABEL] ?? p.method, p.orders, p.revenue]),
      [],
      ["Product", "Quantity", "Sales"],
      ...r.sales.top_products.map((p) => [p.name, p.quantity, p.revenue]),
      [],
      ["Day", "Orders", "Sales"],
      ...r.sales.daily.map((d) => [d.day, d.orders, d.revenue]),
    ];
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pocketgizmo-${kind}-${month}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
