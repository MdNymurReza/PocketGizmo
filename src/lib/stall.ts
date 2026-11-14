import type { Enums, Tables } from "@/lib/database.types";

export type StallOrder = Tables<"stall_orders">;
export type StallOrderItem = Tables<"stall_order_items">;
export type StallStatus = Enums<"stall_order_status">;

export const STALL_STATUS_LABEL: Record<StallStatus, string> = {
  new: "Order taken",
  printing: "Printing",
  ready: "Ready",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const STALL_STATUS_COLOR = {
  new: "warning",
  printing: "accent",
  ready: "info",
  delivered: "success",
  cancelled: "danger",
} as const;

/** The normal path of a stall order. */
export const STALL_FLOW = ["new", "printing", "ready", "delivered"] as const;

/** The usual next step, offered as one button. */
export const STALL_NEXT: Partial<Record<StallStatus, { to: StallStatus; label: string; ok: string }>> = {
  new: { to: "printing", label: "Start printing", ok: "Marked as printing" },
  printing: { to: "ready", label: "Mark as ready", ok: "Marked as ready" },
  ready: { to: "delivered", label: "Mark as delivered", ok: "Marked as delivered" },
};

export const STALL_PAYMENT_METHODS = ["Cash", "bKash", "Nagad", "Rocket"] as const;

/** Where customers collect their orders. The same place every stall day. */
export const STALL_PICKUP_POINT = "Unimart-UIU Permanent Campus";

export const FULFILMENT_LABEL = { pickup: "Customer collects", delivery: "Home delivery" } as const;

/** Today's date in Dhaka as YYYY-MM-DD. */
export const dhakaToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
