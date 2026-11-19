import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The current month in Dhaka, as YYYY-MM. */
export const thisMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }).slice(0, 7);

export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const from = new Date(`${month}-01T00:00:00+06:00`);
  const to = new Date(new Date(`${next}-01T00:00:00+06:00`).getTime() - 1);
  const lastDay = new Date(to.getTime() + 6 * 3600000).toISOString().slice(0, 10);
  return { from, to, fromYmd: `${month}-01`, toYmd: lastDay };
}

export const monthLabel = (month: string) =>
  new Date(`${month}-15T12:00:00+06:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "Asia/Dhaka" });

export const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

export type SalesSummary = {
  totals: { revenue: number; orders: number; aov: number; discounts: number; items: number };
  cancelled: number;
  daily: { day: string; revenue: number; orders: number }[];
  by_payment: { method: string; revenue: number; orders: number }[];
  top_products: { name: string; quantity: number; revenue: number }[];
};

export const REPORT_ORDER_SELECT =
  "order_number, created_at, customer_name, customer_phone, ship_district, status, payment_method, payment_status, subtotal, deal_discount, discount, points_discount, gift_fee, shipping_fee, total, coupon_code, deal_name, courier, tracking_code";

export async function getMonthlyReport(supabase: SupabaseClient<Database>, month: string) {
  const r = monthRange(month);
  const [sales, profit, stall, supplier, points, orders] = await Promise.all([
    supabase.rpc("sales_summary", { p_from: r.from.toISOString(), p_to: r.to.toISOString() }),
    supabase.rpc("admin_profit_summary", { p_from: r.from.toISOString(), p_to: r.to.toISOString() }),
    supabase.rpc("stall_summary", { p_from: r.fromYmd, p_to: r.toYmd }),
    supabase.from("supplier_payments").select("amount, job_count").gte("paid_at", r.from.toISOString()).lte("paid_at", r.to.toISOString()),
    supabase.from("points_ledger").select("delta, reason").gte("created_at", r.from.toISOString()).lte("created_at", r.to.toISOString()),
    supabase.from("orders").select(REPORT_ORDER_SELECT).gte("created_at", r.from.toISOString()).lte("created_at", r.to.toISOString()).order("created_at").limit(5000),
  ]);
  if (sales.error) throw new Error(sales.error.message);

  const pts = points.data ?? [];
  const sum = (reasons: string[]) => pts.filter((p) => reasons.includes(p.reason)).reduce((n, p) => n + p.delta, 0);
  const list = orders.data ?? [];
  const live = list.filter((o) => o.status !== "cancelled");
  const n = (k: keyof (typeof live)[number]) => live.reduce((s, o) => s + Number(o[k] ?? 0), 0);

  return {
    month,
    range: r,
    sales: sales.data as unknown as SalesSummary,
    profit: profit.data,
    stall: stall.data,
    supplierPaid: (supplier.data ?? []).reduce((s, p) => s + Number(p.amount), 0),
    supplierJobs: (supplier.data ?? []).reduce((s, p) => s + p.job_count, 0),
    // Net of reversals: points taken back from cancelled orders, and points handed back after a cancelled redemption.
    points: { earned: sum(["earn", "review", "earn_reversed"]), used: -sum(["redeem", "redeem_refund"]) },
    discounts: { deals: n("deal_discount"), coupons: n("discount"), points: n("points_discount") },
    giftFees: n("gift_fee"),
    shipping: n("shipping_fee"),
    orders: list,
  };
}

export type MonthlyReport = Awaited<ReturnType<typeof getMonthlyReport>>;
