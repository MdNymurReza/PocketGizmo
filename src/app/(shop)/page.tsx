import Link from "next/link";
import { ArrowRight, ArrowUpRight, Banknote, Layers, ShieldCheck, Truck } from "lucide-react";
import { getCategories, getFeatured } from "@/lib/queries";
import { ButtonLink } from "@/components/ui";
import { ProductGrid } from "@/components/shop/product-card";
import { ProductImage } from "@/components/shop/product-image";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";

const VALUE_PROPS = [
  { icon: Layers, title: "Made to order", text: "Every piece is printed fresh in durable, high-quality filament." },
  { icon: Truck, title: "Nationwide delivery", text: "Fast shipping inside and outside Dhaka." },
  { icon: Banknote, title: "Flexible payment", text: "bKash, Nagad, Rocket or cash on delivery." },
  { icon: ShieldCheck, title: "Quality checked", text: "Each print is inspected before it ships." },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Pick your piece", text: "Choose a design and the color you like, or send us your own model." },
  { step: "02", title: "We print it", text: "Your order is printed, cleaned up and quality-checked by hand." },
  { step: "03", title: "Delivered to you", text: "Shipped to your door anywhere in Bangladesh. Track it any time." },
];

export default async function HomePage() {
  const [featured, categories] = await Promise.all([getFeatured(8), getCategories()]);
  const heroProducts = featured.slice(0, 3);

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden border-b border-line">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--line)_1px,transparent_1px),linear-gradient(to_bottom,var(--line)_1px,transparent_1px)] bg-[size:56px_56px] opacity-50 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_65%)]"
        />
        <div aria-hidden className="pointer-events-none absolute -top-40 -right-32 -z-10 size-[520px] rounded-full bg-accent/10 blur-3xl" />

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <Stagger onMount gap={0.09}>
            <StaggerItem>
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-ink-soft shadow-xs">
                <span className="size-1.5 rounded-full bg-accent" aria-hidden />
                Printed to order in Bangladesh
              </p>
            </StaggerItem>
            <StaggerItem>
              <h1 className="mt-5 text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
                Precision-printed accessories for everyday carry.
              </h1>
            </StaggerItem>
            <StaggerItem>
              <p className="mt-5 max-w-lg text-lg text-pretty text-ink-soft">
                Thoughtfully designed and 3D-printed in durable filament. Built for your desk, your phone and your pocket.
              </p>
            </StaggerItem>
            <StaggerItem>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/shop" size="lg" className="group">
                  Shop the collection <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </ButtonLink>
                <ButtonLink href="/custom-order" size="lg" variant="secondary">
                  Request a custom print
                </ButtonLink>
              </div>
            </StaggerItem>
            <StaggerItem>
              <p className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
                <span className="inline-flex items-center gap-1.5">
                  <Truck className="size-4" strokeWidth={1.75} /> Delivery nationwide
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Banknote className="size-4" strokeWidth={1.75} /> Cash on delivery
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="size-4" strokeWidth={1.75} /> Quality checked
                </span>
              </p>
            </StaggerItem>
          </Stagger>

          {heroProducts.length > 0 && (
            <Stagger onMount gap={0.12} className="grid grid-cols-2 gap-4">
              {heroProducts.map((p, i) => (
                <StaggerItem key={p.id} className={i === 0 ? "row-span-2" : ""}>
                  <Link href={`/product/${p.slug}`} className="group relative block h-full">
                    <ProductImage
                      src={p.images[0]}
                      alt={p.name}
                      sizes="(min-width: 1024px) 25vw, 50vw"
                      priority
                      className={`rounded-2xl ${i === 0 ? "h-full min-h-80" : "aspect-square"}`}
                      imgClassName="transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                    />
                    <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-md bg-white/95 px-2.5 py-1 text-xs font-medium shadow-xs backdrop-blur">
                      {p.name}
                      <ArrowUpRight className="size-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </span>
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </div>
      </section>

      {/* Value props */}
      <section className="border-b border-line">
        <Stagger className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {VALUE_PROPS.map(({ icon: Icon, title, text }) => (
            <StaggerItem key={title} className="flex gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-ink">
                <Icon className="size-[18px]" strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="mt-0.5 text-sm text-ink-soft">{text}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
          <Reveal>
            <SectionHeading title="Shop by category" href="/shop" linkLabel="View all" />
          </Reveal>
          <Stagger className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            {categories.map((c) => (
              <StaggerItem key={c.id}>
                <Link
                  href={`/shop?category=${c.slug}`}
                  className="group flex min-h-32 flex-col justify-between rounded-xl border border-line bg-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-ink/15 hover:bg-white hover:shadow-[0_10px_30px_-14px_rgba(11,11,15,0.25)]"
                >
                  <ArrowUpRight className="size-5 self-end text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink" />
                  <span className="font-medium">{c.name}</span>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}

      {/* Featured */}
      <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
        <Reveal>
          <SectionHeading title="Best sellers" href="/shop" linkLabel="Shop all" />
        </Reveal>
        <div className="mt-8">
          {featured.length ? <ProductGrid products={featured} /> : <p className="text-ink-soft">New products are on the way.</p>}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
        </Reveal>
        <Stagger className="mt-8 grid gap-4 md:grid-cols-3">
          {HOW_IT_WORKS.map((s) => (
            <StaggerItem key={s.step} className="rounded-xl border border-line p-6">
              <p className="font-mono text-sm text-accent">{s.step}</p>
              <p className="mt-4 font-medium">{s.title}</p>
              <p className="mt-1 text-sm text-ink-soft">{s.text}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Custom print CTA */}
      <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6">
        <Reveal className="relative isolate grid items-center gap-8 overflow-hidden rounded-2xl bg-ink px-8 py-12 text-white sm:px-12 lg:grid-cols-[1.4fr_1fr]">
          <div aria-hidden className="pointer-events-none absolute -right-24 -bottom-40 -z-10 size-96 rounded-full bg-accent/40 blur-3xl" />
          <div>
            <p className="text-sm font-medium text-white/60">Custom printing</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Have a design in mind? We&apos;ll print it.</h2>
            <p className="mt-3 max-w-lg text-white/70">
              Upload an STL, 3MF or OBJ file, or describe what you need. We&apos;ll review it and send you a quote.
            </p>
          </div>
          <div className="lg:justify-self-end">
            <ButtonLink href="/custom-order" size="lg" className="group bg-white text-ink hover:bg-white/90">
              Start a custom order <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </ButtonLink>
          </div>
        </Reveal>
      </section>
    </>
  );
}

function SectionHeading({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      <Link href={href} className="group inline-flex items-center gap-1 text-sm font-medium text-ink-soft transition-colors hover:text-ink">
        {linkLabel} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
