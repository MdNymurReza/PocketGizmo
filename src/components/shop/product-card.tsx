import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { CardProduct } from "@/lib/queries";
import { ProductImage } from "./product-image";
import { Reveal } from "@/components/motion";
import { formatBDT } from "@/lib/utils";

export function ProductCard({ product, priority }: { product: CardProduct; priority?: boolean }) {
  const active = product.product_variants.filter((v) => v.is_active);
  const soldOut = active.length > 0 && active.every((v) => v.stock <= 0);
  const lowStock = !soldOut && active.length > 0 && active.reduce((n, v) => n + Math.max(0, v.stock), 0) <= 3;
  const prices = active.map((v) => Number(v.price));
  const min = prices.length ? Math.min(...prices) : Number(product.base_price);
  const varied = prices.length > 1 && Math.max(...prices) !== min;
  const onSale = product.compare_at_price && Number(product.compare_at_price) > min;
  const colorKey = Object.keys(active[0]?.options ?? {}).find((k) => /colou?r/i.test(k));
  const colors = colorKey ? new Set(active.map((v) => v.options[colorKey])).size : 0;
  const badge = soldOut ? "Sold out" : onSale ? "Sale" : lowStock ? "Few left" : null;

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
    >
      <div className="relative">
        <ProductImage
          src={product.images[0]}
          hoverSrc={product.images[1]}
          alt={product.name}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          priority={priority}
          className="aspect-[4/5] rounded-xl"
          imgClassName="transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
        />
        {badge && (
          <span
            className={`absolute top-3 left-3 rounded-md px-2 py-1 text-xs font-medium shadow-xs ${
              soldOut ? "bg-ink text-white" : "bg-white/95 text-ink"
            }`}
          >
            {badge}
          </span>
        )}
        <span
          aria-hidden
          className="absolute right-3 bottom-3 grid size-9 translate-y-2 place-items-center rounded-full bg-white text-ink opacity-0 shadow-md transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
        >
          <ArrowUpRight className="size-4" />
        </span>
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium decoration-ink/30 underline-offset-4 group-hover:underline">{product.name}</h3>
          <p className="mt-0.5 truncate text-sm text-ink-soft">
            {product.categories?.name}
            {colors > 1 && <span> · {colors} colors</span>}
          </p>
        </div>
        <p className="shrink-0 text-right text-sm">
          <span className="font-medium">
            {varied && <span className="font-normal text-ink-soft">From </span>}
            {formatBDT(min)}
          </span>
          {onSale && <span className="block text-xs text-ink-soft line-through">{formatBDT(product.compare_at_price)}</span>}
        </p>
      </div>
    </Link>
  );
}

export function ProductGrid({ products }: { products: CardProduct[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p, i) => (
        <Reveal key={p.id} delay={(i % 4) * 0.06}>
          <ProductCard product={p} priority={i < 4} />
        </Reveal>
      ))}
    </div>
  );
}
