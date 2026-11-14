import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** What the offline stall app keeps on the device: the product list and the orders that are still open. */
export async function GET() {
  const { supabase, profile } = await getSessionProfile();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Log in as the admin first" }, { status: 401 });

  const [{ data: products }, { data: orders }] = await Promise.all([
    supabase.from("stall_products").select("id, name, price").eq("is_active", true).order("name"),
    supabase
      .from("stall_orders")
      .select("order_number, customer_name, customer_phone, total, paid_amount, status, stall_order_items(name, quantity)")
      .in("status", ["new", "printing", "ready"])
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  return NextResponse.json({
    products: (products ?? []).map((p) => ({ id: p.id, name: p.name, price: Number(p.price) })),
    orders: (orders ?? []).map((o) => ({
      orderNumber: o.order_number,
      customerName: o.customer_name,
      customerPhone: o.customer_phone,
      total: Number(o.total),
      paid: Number(o.paid_amount),
      status: o.status,
      items: o.stall_order_items.map((i) => `${i.quantity} × ${i.name}`).join(", "),
    })),
  });
}
