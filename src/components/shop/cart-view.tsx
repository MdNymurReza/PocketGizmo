"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, ShoppingBag, Truck, X } from "lucide-react";
import { DETAILS_MAX, cartSubtotal, useCart } from "@/lib/cart-store";
import { useCartSync } from "@/lib/use-cart-sync";
import { ButtonLink } from "@/components/ui";
import { ProductImage } from "./product-image";
import { formatBDT, variantLabel } from "@/lib/utils";

/** freeOver: order value from which delivery is free, if the store offers that. */
export function CartView({ freeOver }: { freeOver: number | null }) {
  const { ready, synced } = useCartSync();
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const setDetails = useCart((s) => s.setDetails);

  if (!ready) {
    return (
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]" aria-busy="true" aria-label="Loading your cart">
        <div className="grid gap-6">
          {[0, 1].map((n) => (
            <div key={n} className="flex gap-4">
              <div className="skeleton size-24 rounded-lg sm:size-28" />
              <div className="grid flex-1 content-start gap-2 pt-1">
                <div className="skeleton h-4 w-1/2 rounded" />
                <div className="skeleton h-3 w-1/4 rounded" />
              </div>
            </div>
          ))}
        </div>
        <div className="skeleton h-56 rounded-xl" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="mt-8 rounded-xl border border-dashed border-line px-6 py-20 text-center">
        <ShoppingBag className="mx-auto size-8 text-ink-soft" strokeWidth={1.5} />
        <p className="mt-4 font-medium">Your cart is empty</p>
        <p className="mt-1 text-sm text-ink-soft">Browse the collection and add something you like.</p>
        <ButtonLink href="/shop" className="mt-6">Continue shopping</ButtonLink>
      </div>
    );
  }

  const subtotal = cartSubtotal(items);
  const toFree = freeOver != null && freeOver > 0 ? Math.max(0, freeOver - subtotal) : null;

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
      <ul className="border-y border-line">
        <AnimatePresence initial={false}>
        {items.map((i) => (
          <motion.li
            key={i.variantId}
            layout
            exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0, transition: { duration: 0.25 } }}
            className="flex gap-4 overflow-hidden border-b border-line py-6 last:border-b-0"
          >
            <Link href={`/product/${i.slug}`} className="shrink-0">
              <ProductImage src={i.image} alt={i.name} sizes="112px" className="size-24 rounded-lg sm:size-28" />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/product/${i.slug}`} className="font-medium hover:underline">{i.name}</Link>
                  {variantLabel(i.options) && <p className="mt-0.5 text-sm text-ink-soft">{variantLabel(i.options)}</p>}
                  <p className="mt-0.5 text-sm text-ink-soft">{formatBDT(i.price)} each</p>
                </div>
                <button onClick={() => remove(i.variantId)} className="rounded-md p-1 text-ink-soft hover:bg-surface hover:text-ink" aria-label={`Remove ${i.name}`}>
                  <X className="size-4" />
                </button>
              </div>
              <label className="mt-3 block text-sm">
                <span className="text-ink-soft">Details (optional)</span>
                <input
                  type="text"
                  value={i.details ?? ""}
                  onChange={(e) => setDetails(i.variantId, e.target.value)}
                  maxLength={DETAILS_MAX}
                  placeholder="e.g. name and number for a jersey"
                  className="mt-1 h-9 w-full max-w-sm rounded-lg border border-line bg-white px-3 text-sm outline-none placeholder:text-ink-soft/60 focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>
              <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                <div className="flex h-9 items-center rounded-lg border border-line">
                  <button className="grid h-full w-9 place-items-center text-ink-soft hover:text-ink" onClick={() => setQty(i.variantId, i.quantity - 1)} aria-label="Decrease quantity">
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-6 text-center text-sm font-medium tabular-nums">{i.quantity}</span>
                  <button className="grid h-full w-9 place-items-center text-ink-soft hover:text-ink disabled:opacity-30" onClick={() => setQty(i.variantId, i.quantity + 1)} disabled={i.quantity >= i.stock} aria-label="Increase quantity">
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <span className="font-medium tabular-nums">{formatBDT(i.price * i.quantity)}</span>
              </div>
            </div>
          </motion.li>
        ))}
        </AnimatePresence>
      </ul>

      <section className="h-fit rounded-xl bg-surface p-6 lg:sticky lg:top-24" aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="font-semibold">Order summary</h2>
        {toFree != null && freeOver != null && (
          <div className="mt-4 rounded-lg border border-line bg-white p-3 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <Truck className={toFree === 0 ? "size-4 text-success" : "size-4 text-ink-soft"} />
              {toFree === 0 ? "You get free delivery" : `Add ${formatBDT(toFree)} more for free delivery`}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <div
                className={toFree === 0 ? "h-full rounded-full bg-success" : "h-full rounded-full bg-accent"}
                style={{ width: `${Math.min(100, (subtotal / freeOver) * 100)}%` }}
              />
            </div>
          </div>
        )}
        <dl className="mt-5 grid gap-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-soft">Subtotal</dt>
            <dd className="font-medium tabular-nums">{formatBDT(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">Delivery</dt>
            <dd className="text-ink-soft">{toFree === 0 ? "Free" : "Calculated at checkout"}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-3 text-base">
            <dt className="font-medium">Estimated total</dt>
            <dd className="font-semibold tabular-nums">{formatBDT(subtotal)}</dd>
          </div>
        </dl>
        <ButtonLink href="/checkout" size="lg" className="mt-6 w-full" aria-disabled={!synced}>
          {synced ? "Checkout" : "Checking availability…"}
        </ButtonLink>
        <Link href="/shop" className="mt-4 block text-center text-sm text-ink-soft hover:text-ink">
          or continue shopping
        </Link>
      </section>
    </div>
  );
}
