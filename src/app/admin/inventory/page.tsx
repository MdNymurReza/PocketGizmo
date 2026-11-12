import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, Input, PageTitle, buttonStyles } from "@/components/ui";
import { StockAdjuster } from "@/components/admin/stock-adjuster";
import { formatDate, variantLabel } from "@/lib/utils";

export const metadata: Metadata = { title: "Inventory" };

const REASON_COLOR = { order: "info", restock: "success", adjust: "warning", cancel: "accent" } as const;

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string; low?: string }> }) {
  const { q = "", low } = await searchParams;
  const supabase = await createClient();

  const [{ data: variants }, { data: movements }] = await Promise.all([
    supabase
      .from("product_variants")
      .select("id, sku, options, stock, low_stock_threshold, is_active, products!inner(id, name, is_active)")
      .order("stock"),
    supabase
      .from("inventory_movements")
      .select("id, delta, reason, note, created_at, order_id, product_variants(options, products(name))")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const term = q.trim().toLowerCase();
  const rows = (variants ?? []).filter((v) => {
    if (low && v.stock > v.low_stock_threshold) return false;
    if (!term) return true;
    const hay = `${v.products.name} ${v.sku ?? ""} ${variantLabel(v.options as Record<string, string>)}`.toLowerCase();
    return hay.includes(term);
  });
  const lowCount = (variants ?? []).filter((v) => v.is_active && v.stock <= v.low_stock_threshold).length;

  return (
    <>
      <PageTitle>Inventory</PageTitle>

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <Input name="q" defaultValue={q} placeholder="Search product, SKU or option…" className="max-w-xs" aria-label="Search inventory" />
        {low && <input type="hidden" name="low" value="1" />}
        <button className={buttonStyles({ variant: "secondary", size: "md" })}>Search</button>
        <Link
          href={low ? `/admin/inventory${q ? `?q=${encodeURIComponent(q)}` : ""}` : `/admin/inventory?low=1${q ? `&q=${encodeURIComponent(q)}` : ""}`}
          className={buttonStyles({ variant: low ? "primary" : "secondary", size: "md" })}
        >
          Low stock only {lowCount > 0 && <Badge color="danger">{lowCount}</Badge>}
        </Link>
      </form>

      <div className="grid gap-6 2xl:grid-cols-[1fr_380px]">
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs font-medium text-ink-soft">
              <tr>
                <th className="px-4 py-3 font-medium">Product / variant</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Adjust</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((v) => {
                const isLow = v.stock <= v.low_stock_threshold;
                return (
                  <tr key={v.id} className={v.is_active && v.products.is_active ? "" : "opacity-50"}>
                    <td className="px-4 py-3">
                      <Link href={`/admin/products/${v.products.id}`} className="font-medium hover:text-accent">{v.products.name}</Link>
                      <span className="block text-ink-soft">{variantLabel(v.options as Record<string, string>) || "Default"}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{v.sku ?? "–"}</td>
                    <td className="px-4 py-3">
                      <Badge color={v.stock === 0 ? "danger" : isLow ? "warning" : "success"} className="text-sm">
                        {v.stock}
                      </Badge>
                      {isLow && <span className="ml-2 text-xs text-ink-soft">alert at {v.low_stock_threshold}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StockAdjuster variantId={v.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <p className="p-6 text-ink-soft">Nothing matches.</p>}
        </Card>

        <Card className="h-fit">
          <h2 className="mb-3 text-base font-semibold">Recent stock changes</h2>
          {movements?.length ? (
            <ul className="grid gap-3 text-sm">
              {movements.map((m) => (
                <li key={m.id} className="flex items-start gap-3">
                  <span className={`w-12 shrink-0 text-right font-medium ${m.delta > 0 ? "text-success" : "text-danger"}`}>
                    {m.delta > 0 ? `+${m.delta}` : m.delta}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{m.product_variants?.products?.name ?? "Deleted product"}</span>{" "}
                    <span className="text-ink-soft">{variantLabel(m.product_variants?.options as Record<string, string>)}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                      <Badge color={REASON_COLOR[m.reason]}>{m.reason}</Badge>
                      {formatDate(m.created_at)}
                      {m.note && <span>· {m.note}</span>}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-soft">No stock changes yet.</p>
          )}
        </Card>
      </div>
    </>
  );
}
