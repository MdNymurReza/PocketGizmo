import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Layers, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { getStoreSettings } from "@/lib/store-settings";
import { getProductBySlug, getRelated } from "@/lib/queries";
import { Gallery } from "@/components/shop/gallery";
import { PurchasePanel } from "@/components/shop/purchase-panel";
import { ProductGrid } from "@/components/shop/product-card";
import { Reveal } from "@/components/motion";
import { createClient } from "@/lib/supabase/server";
import { ReviewsSection } from "@/components/shop/reviews-section";
import { Stars } from "@/components/shop/stars";
import { WishlistButton } from "@/components/shop/wishlist-button";

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
  { icon: ShieldCheck, text: "Quality-checked before it ships" },
  { icon: MapPin, text: "Track your order online" },
  { icon: Sparkles, text: "Custom colors on request" },
];

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || product.product_variants.length === 0) notFound();
  const supabase = await createClient();
  const [related, settings, { data: filaments }, { data: savedRow }, { data: reviewRows }] = await Promise.all([
    getRelated(product.id, product.category_id),
    getStoreSettings(),
    supabase.from("filaments").select("color, hex"),
    // Row-level security returns a row only when the logged-in customer saved this product.
    supabase.from("wishlist_items").select("product_id").eq("product_id", product.id).maybeSingle(),
    // Row-level security already limits visitors to approved reviews; the filter keeps the author's own pending one out of the public list.
    supabase
      .from("reviews")
      .select("id, author_name, rating, comment, photos, created_at")
      .eq("product_id", product.id)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  const reviews = reviewRows ?? [];
  const colorHex = Object.fromEntries((filaments ?? []).map((f) => [f.color.trim().toLowerCase(), f.hex]));
  const ratingAvg = reviews.length ? reviews.reduce((n, r) => n + r.rating, 0) / reviews.length : 0;

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
    ...(reviews.length > 0 && {
      aggregateRating: { "@type": "AggregateRating", ratingValue: Number(ratingAvg.toFixed(1)), reviewCount: reviews.length },
    }),
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

      {/* The photo column has a fixed width on desktop, so the photo stays one size whatever the screen. */}
      <div className="grid items-start gap-10 lg:grid-cols-[440px_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[520px_minmax(0,1fr)] xl:gap-16">
        <div className="lg:sticky lg:top-24">
          <Gallery images={product.images} name={product.name} />
        </div>
        <div className="min-w-0 lg:max-w-xl lg:pt-2">
          {product.categories && <p className="text-sm text-ink-soft">{product.categories.name}</p>}
          <h1 className="mt-1 text-2xl font-semibold break-words sm:text-3xl">{product.name}</h1>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <a href="#reviews" className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink">
            {reviews.length > 0 ? (
              <>
                <Stars rating={ratingAvg} />
                <span>
                  <span className="font-medium text-ink">{ratingAvg.toFixed(1)}</span> · {reviews.length} review{reviews.length === 1 ? "" : "s"}
                </span>
              </>
            ) : (
              <span className="underline underline-offset-4">No reviews yet</span>
            )}
          </a>
          <WishlistButton productId={product.id} slug={product.slug} initialSaved={Boolean(savedRow)} />
          </div>
          <div className="mt-6">
            <PurchasePanel
              product={{ id: product.id, slug: product.slug, name: product.name, image: product.images[0] ?? null }}
              variants={variants}
              compareAt={product.compare_at_price ? Number(product.compare_at_price) : null}
              shipping={{ insideDhaka: settings.insideDhaka, outsideDhaka: settings.outsideDhaka, freeOver: settings.freeOver }}
              colorHex={colorHex}
            />
          </div>

          <ul className="mt-6 grid gap-3 text-sm text-ink-soft sm:grid-cols-2">
            {PERKS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 rounded-xl bg-surface px-3.5 py-3">
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

      <ReviewsSection productId={product.id} slug={product.slug} reviews={reviews} />

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
