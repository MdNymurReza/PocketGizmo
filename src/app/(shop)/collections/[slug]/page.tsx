import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Clock, Layers, TicketPercent } from "lucide-react";
import { getCollection } from "@/lib/queries";
import { getSessionProfile } from "@/lib/supabase/server";
import { ProductGrid } from "@/components/shop/product-card";
import { Countdown } from "@/components/shop/countdown";
import { CopyButton } from "@/components/copy-button";
import { ButtonLink, EmptyState } from "@/components/ui";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCollection(slug);
  if (!c) return { title: "Collection" };
  return {
    title: c.title,
    description: c.subtitle ?? undefined,
    openGraph: c.banner_image ? { images: [c.banner_image] } : undefined,
    robots: c.live ? undefined : { index: false },
  };
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getCollection(slug);
  if (!c) notFound();
  if (!c.live) {
    // Hidden or out-of-date collections are only visible to admins, as a preview.
    const { profile } = await getSessionProfile();
    if (profile?.role !== "admin") notFound();
  }

  return (
    <div>
      <section className="relative isolate overflow-hidden border-b border-line bg-surface">
        {c.banner_image && (
          <Image src={c.banner_image} alt="" fill priority sizes="100vw" className="-z-10 object-cover opacity-25" />
        )}
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
          {!c.live && <p className="mb-4 inline-block rounded-md bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning">Preview: customers can&rsquo;t see this yet</p>}
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{c.title}</h1>
          {c.subtitle && <p className="mt-4 max-w-2xl text-lg text-pretty text-ink-soft">{c.subtitle}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
            {c.ends_at && (
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 font-medium shadow-xs ring-1 ring-line">
                <Clock className="size-4 text-accent" /> <Countdown to={c.ends_at} />
              </span>
            )}
            {c.coupon_code && (
              <span className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3.5 py-1.5 font-medium text-accent">
                <TicketPercent className="size-4" /> Use code <span className="font-mono">{c.coupon_code}</span> at checkout
                <CopyButton value={c.coupon_code} label="Copy coupon code" />
              </span>
            )}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {c.products.length ? (
          <ProductGrid products={c.products} />
        ) : (
          <EmptyState
            icon={Layers}
            title="Products are coming soon"
            text="We're adding pieces to this collection."
            action={<ButtonLink href="/shop" variant="secondary">Browse the shop</ButtonLink>}
            className="rounded-xl border border-dashed border-line"
          />
        )}
      </section>
    </div>
  );
}
