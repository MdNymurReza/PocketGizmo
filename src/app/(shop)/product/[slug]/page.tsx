import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Banknote, ChevronRight, Layers, ShieldCheck, Truck } from "lucide-react";
import { getProductBySlug, getRelated } from "@/lib/queries";
import { Gallery } from "@/components/shop/gallery";
import { PurchasePanel } from "@/components/shop/purchase-panel";
import { ProductGrid } from "@/components/shop/product-card";
import { Reveal } from "@/components/motion";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  const description = product.description.slice(0, 160) || `${product.name}, 3D printed by PocketGizmo.`;
  return {
    title: product.name,
    description,
    openGraph: { title: product.name, description, images: product.images.slice(0, 1) },
  };
}

const PERKS = [
  { icon: Layers, text: "Printed to order" },
  { icon: Truck, text: "Delivery across Bangladesh, trackable online" },
  { icon: Banknote, text: "bKash, Nagad, Rocket or cash on delivery" },
  { icon: ShieldCheck, text: "Quality-checked before it ships" },
];

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || product.product_variants.length === 0) notFound();
  const related = await getRelated(product.id, product.category_id);

  const variants = product.product_variants.map((v) => ({ id: v.id, options: v.options, price: Number(v.price), stock: v.stock }));
  const inStock = variants.some((v) => v.stock > 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "BDT",
      lowPrice: Math.min(...variants.map((v) => v.price)),
      highPrice: Math.max(...variants.map((v) => v.price)),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <nav aria-label="Breadcrumb" className="mb-8 flex items-center gap-1.5 text-sm text-ink-soft">
        <Link href="/" className="hover:text-ink">Home</Link>
        <ChevronRight className="size-3.5" />
        <Link href="/shop" className="hover:text-ink">Shop</Link>
        {product.categories && (
          <>
            <ChevronRight className="size-3.5" />
            <Link href={`/shop?category=${product.categories.slug}`} className="hover:text-ink">{product.categories.name}</Link>
          </>
        )}
        <ChevronRight className="size-3.5" />
        <span className="truncate text-ink">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        <Gallery images={product.images} name={product.name} />
        <div className="h-fit lg:sticky lg:top-24 lg:pt-2">
          {product.categories && <p className="text-sm text-ink-soft">{product.categories.name}</p>}
          <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{product.name}</h1>
          <div className="mt-6">
            <PurchasePanel
              product={{ id: product.id, slug: product.slug, name: product.name, image: product.images[0] ?? null }}
              variants={variants}
              compareAt={product.compare_at_price ? Number(product.compare_at_price) : null}
            />
          </div>

          <ul className="mt-8 grid gap-3 border-t border-line pt-6 text-sm text-ink-soft">
            {PERKS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <Icon className="size-4 shrink-0 text-ink" strokeWidth={1.75} /> {text}
              </li>
            ))}
          </ul>

          {product.description && (
            <section className="mt-8 border-t border-line pt-6">
              <h2 className="text-sm font-semibold">Description</h2>
              <p className="mt-2 leading-relaxed whitespace-pre-line text-ink-soft">{product.description}</p>
            </section>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-24">
          <Reveal>
            <h2 className="mb-8 text-2xl font-semibold">You may also like</h2>
          </Reveal>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
