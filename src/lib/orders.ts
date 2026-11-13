import type { Enums } from "@/lib/database.types";

export type TrackedOrder = {
  order_number: string;
  status: Enums<"order_status">;
  payment_method: Enums<"payment_method">;
  payment_status: Enums<"payment_status">;
  subtotal: number;
  discount: number;
  shipping_fee: number;
  total: number;
  courier: string | null;
  tracking_code: string | null;
  customer_name: string;
  ship_area: string;
  ship_district: string;
  created_at: string;
  advance_amount: number;
  advance_method: Enums<"payment_method"> | null;
  advance_status: "none" | "pending" | "verified" | "rejected";
  items: { name: string; options: Record<string, string>; image: string | null; unit_price: number; quantity: number; line_total: number; details?: string | null }[];
  history: { status: Enums<"order_status">; note: string | null; created_at: string }[];
};

export const PAYMENT_STATUS_LABEL: Record<Enums<"payment_status">, string> = {
  unpaid: "Unpaid",
  pending_verification: "Verifying payment",
  paid: "Paid",
  rejected: "Payment rejected",
  refunded: "Refunded",
};

export const PAYMENT_STATUS_COLOR = {
  unpaid: "neutral",
  pending_verification: "warning",
  paid: "success",
  rejected: "danger",
  refunded: "info",
} as const;

export const ORDER_STATUS_COLOR = {
  pending: "warning",
  confirmed: "info",
  printing: "accent",
  shipped: "info",
  delivered: "success",
  cancelled: "danger",
} as const;

/** The normal path an order moves through, used by the progress tracker. */
export const ORDER_FLOW = ["pending", "confirmed", "printing", "shipped", "delivered"] as const;

export const ADVANCE_STATUS_LABEL = {
  none: "No advance",
  pending: "Verifying delivery charge",
  verified: "Delivery charge received",
  rejected: "Delivery charge rejected",
} as const;

export const ADVANCE_STATUS_COLOR = {
  none: "neutral",
  pending: "warning",
  verified: "success",
  rejected: "danger",
} as const;
