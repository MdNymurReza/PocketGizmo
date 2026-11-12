import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ImageIcon, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, ButtonLink, Card, PageTitle } from "@/components/ui";
import { formatBDT } from "@/lib/utils";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, slug, images, is_active, featured, categories(name), product_variants(price, stock, is_active, low_stock_threshold)")
    .order("created_at", { ascending: false });

  return (
    <>
      <PageTitle
        action={
          <ButtonLink href="/admin/products/new">
            <Plus className="size-4" /> New product
          </ButtonLink>
        }
      >
        Products
      </PageTitle>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-left">
          <thead className="border-b border-line bg-surface text-xs font-medium text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(products ?? []).map((p) => {
              const vs = p.product_variants.filter((v) => v.is_active);
              const prices = vs.map((v) => Number(v.price));
              const stock = vs.reduce((n, v) => n + v.stock, 0);
              const low = vs.some((v) => v.stock <= v.low_stock_threshold);
              const min = Math.min(...prices);
              const max = Math.max(...prices);
              return (
                <tr key={p.id} className="hover:bg-surface">
                  <td className="px-4 py-3">
                    <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 font-medium hover:text-accent">
                      <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-surface">
                        {p.images[0] ? (
                          <Image src={p.images[0]} alt="" fill sizes="48px" className="object-cover" />
                        ) : (
                          <ImageIcon className="size-5 text-ink-soft" />
                        )}
                      </span>
                      <span>
                        {p.name}
                        <span className="block text-xs font-normal text-ink-soft">{vs.length} variant{vs.length === 1 ? "" : "s"}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm">{p.categories?.name ?? <span className="text-ink-soft">None</span>}</td>
                  <td className="px-4 py-3 text-sm tabular-nums">
                    {prices.length ? (min === max ? formatBDT(min) : `${formatBDT(min)} – ${formatBDT(max)}`) : "–"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={stock === 0 ? "danger" : low ? "warning" : "success"}>
                      {stock === 0 ? "Out of stock" : `${stock} in stock`}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Badge color={p.is_active ? "success" : "neutral"}>{p.is_active ? "Live" : "Hidden"}</Badge>
                      {p.featured && <Badge color="accent">Featured</Badge>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!products?.length && <p className="p-6 text-ink-soft">No products yet.</p>}
      </Card>
    </>
  );
}
