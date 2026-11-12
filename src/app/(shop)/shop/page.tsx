import type { Metadata } from "next";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { getCategories, getProducts, PAGE_SIZE, type ShopFilters } from "@/lib/queries";
import { Button, ButtonLink, Input } from "@/components/ui";
import { ProductGrid } from "@/components/shop/product-card";
import { SortSelect } from "@/components/shop/sort-select";
import { cn } from "@/lib/utils";

type Props = { searchParams: Promise<ShopFilters> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { category, q } = await searchParams;
  if (q) return { title: `Search: ${q}` };
  if (category) {
    const cat = (await getCategories()).find((c) => c.slug === category);
    if (cat) return { title: cat.name };
  }
  return { title: "Shop all products" };
}

export default async function ShopPage({ searchParams }: Props) {
  const filters = await searchParams;
  const [{ products, total, page }, categories] = await Promise.all([getProducts(filters), getCategories()]);
  const activeCat = categories.find((c) => c.slug === filters.category);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const href = (patch: Partial<ShopFilters>) => {
    const params = new URLSearchParams();
    const merged = { ...filters, page: undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, String(v));
    const s = params.toString();
    return s ? `/shop?${s}` : "/shop";
  };

  const chips = [
    activeCat && { label: activeCat.name, remove: href({ category: undefined }) },
    filters.q && { label: `“${filters.q}”`, remove: href({ q: undefined }) },
    (filters.min || filters.max) && {
      label: `৳${filters.min || 0} – ${filters.max ? `৳${filters.max}` : "any"}`,
      remove: href({ min: undefined, max: undefined }),
    },
  ].filter(Boolean) as { label: string; remove: string }[];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="border-b border-line pb-6">
        <h1 className="text-3xl font-semibold">
          {activeCat?.name ?? (filters.q ? `Results for “${filters.q}”` : "All products")}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {total} product{total === 1 ? "" : "s"}
        </p>
        {chips.length > 0 && (
          <ul className="mt-4 flex flex-wrap items-center gap-2" aria-label="Active filters">
            {chips.map((c) => (
              <li key={c.label}>
                <Link
                  href={c.remove}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pr-2 pl-3 text-xs font-medium transition-colors hover:border-ink/30"
                  aria-label={`Remove filter: ${c.label}`}
                >
                  {c.label} <X className="size-3 text-ink-soft" />
                </Link>
              </li>
            ))}
            <li>
              <Link href="/shop" className="px-1 text-xs font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline">
                Clear all
              </Link>
            </li>
          </ul>
        )}
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[220px_1fr]">
        <aside className="grid h-fit gap-8">
          <form action="/shop" className="relative">
            {filters.category && <input type="hidden" name="category" value={filters.category} />}
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
            <Input name="q" defaultValue={filters.q} placeholder="Search products" aria-label="Search products" className="pl-9" />
          </form>

          <nav aria-label="Categories">
            <h2 className="mb-3 text-sm font-semibold">Category</h2>
            <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-0.5">
              {[{ slug: "", name: "All products" }, ...categories].map((c) => {
                const active = (filters.category ?? "") === c.slug;
                return (
                  <li key={c.slug || "all"}>
                    <Link
                      href={href({ category: c.slug || undefined })}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block rounded-md px-3 py-1.5 text-sm transition-colors lg:px-2",
                        active
                          ? "bg-ink font-medium text-white lg:bg-surface lg:text-ink"
                          : "border border-line text-ink-soft hover:text-ink lg:border-0",
                      )}
                    >
                      {c.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <form action="/shop" className="grid gap-3">
            <h2 className="text-sm font-semibold">Price (৳)</h2>
            {filters.category && <input type="hidden" name="category" value={filters.category} />}
            {filters.q && <input type="hidden" name="q" value={filters.q} />}
            {filters.sort && <input type="hidden" name="sort" value={filters.sort} />}
            <div className="flex items-center gap-2">
              <Input name="min" type="number" min={0} defaultValue={filters.min} placeholder="Min" aria-label="Minimum price" />
              <span className="text-ink-soft" aria-hidden>–</span>
              <Input name="max" type="number" min={0} defaultValue={filters.max} placeholder="Max" aria-label="Maximum price" />
            </div>
            <Button variant="secondary" size="sm" type="submit">Apply</Button>
          </form>
        </aside>

        <div>
          <div className="mb-6 flex justify-end">
            <SortSelect value={filters.sort ?? ""} />
          </div>
          {products.length ? (
            <ProductGrid products={products} />
          ) : (
            <div className="rounded-xl border border-dashed border-line px-6 py-16 text-center">
              <p className="font-medium">No products found</p>
              <p className="mt-1 text-sm text-ink-soft">Try a different search or clear your filters.</p>
              <ButtonLink href="/shop" variant="secondary" className="mt-5">Clear filters</ButtonLink>
            </div>
          )}

          {pages > 1 && (
            <nav className="mt-14 flex justify-center gap-1" aria-label="Pagination">
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={href({ page: n === 1 ? undefined : String(n) })}
                  aria-current={n === page ? "page" : undefined}
                  className={cn(
                    "grid size-9 place-items-center rounded-md text-sm font-medium",
                    n === page ? "bg-ink text-white" : "text-ink-soft hover:bg-surface hover:text-ink",
                  )}
                >
                  {n}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
