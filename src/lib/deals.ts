import type { Tables } from "@/lib/database.types";

export type Deal = Pick<Tables<"deals">, "id" | "name" | "kind" | "buy_qty" | "get_qty" | "bundle_qty" | "bundle_price" | "category_id" | "product_ids" | "starts_at" | "ends_at" | "active">;

export const DEAL_SELECT = "id, name, kind, buy_qty, get_qty, bundle_qty, bundle_price, category_id, product_ids, starts_at, ends_at, active";

/** Short customer-facing rule, e.g. "Buy 2, get 1 free" or "Any 3 for ৳350". */
export function dealRule(d: Pick<Deal, "kind" | "buy_qty" | "get_qty" | "bundle_qty" | "bundle_price">) {
  if (d.kind === "buy_x_get_y") return `Buy ${d.buy_qty}, get ${d.get_qty} free`;
  return `Any ${d.bundle_qty} for ৳${Number(d.bundle_price ?? 0).toLocaleString("en-US")}`;
}

export const isLive = (d: Pick<Deal, "active" | "starts_at" | "ends_at">, now = Date.now()) =>
  d.active && (!d.starts_at || Date.parse(d.starts_at) <= now) && (!d.ends_at || Date.parse(d.ends_at) > now);

/** Whether a deal covers this product (same rule as compute_deal_discount in the database). */
export function dealCovers(d: Pick<Deal, "product_ids" | "category_id">, product: { id: string; category_id: string | null }) {
  if (d.product_ids.length) return d.product_ids.includes(product.id);
  if (d.category_id) return d.category_id === product.category_id;
  return true;
}
