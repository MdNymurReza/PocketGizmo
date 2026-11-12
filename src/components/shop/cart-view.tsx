"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { cartSubtotal, useCart } from "@/lib/cart-store";
import { useCartSync } from "@/lib/use-cart-sync";
import { ButtonLink } from "@/components/ui";
import { ProductImage } from "./product-image";
import { formatBDT, variantLabel } from "@/lib/utils";

export function CartView() {
  const { ready, synced } = useCartSync();
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);

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
        <dl className="mt-5 grid gap-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-soft">Subtotal</dt>
            <dd className="font-medium tabular-nums">{formatBDT(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">Delivery</dt>
            <dd className="text-ink-soft">Calculated at checkout</dd>
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
