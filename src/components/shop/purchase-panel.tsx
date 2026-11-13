"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Banknote, Check, Minus, Plus, ShoppingBag, Truck, Zap } from "lucide-react";
import { toast } from "sonner";
import { DETAILS_MAX, useCart } from "@/lib/cart-store";
import { Button } from "@/components/ui";
import { FilamentSwatch } from "@/components/filament-swatch";
import { cn, formatBDT } from "@/lib/utils";

type Variant = { id: string; options: Record<string, string>; price: number; stock: number };

export function PurchasePanel({
  product,
  variants,
  compareAt,
  shipping,
  colorHex = {},
}: {
  product: { id: string; slug: string; name: string; image: string | null };
  variants: Variant[];
  compareAt: number | null;
  shipping: { insideDhaka: number; outsideDhaka: number; freeOver: number | null };
  /** Lower-cased color name to hex, from the filament list. Used to show color dots. */
  colorHex?: Record<string, string | null>;
}) {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const inCart = useCart((s) => s.items);

  const optionNames = useMemo(() => [...new Set(variants.flatMap((v) => Object.keys(v.options)))], [variants]);
  const valuesFor = (name: string) => [...new Set(variants.map((v) => v.options[name]).filter(Boolean))];

  const firstAvailable = variants.find((v) => v.stock > 0) ?? variants[0];
  const [selected, setSelected] = useState<Record<string, string>>(firstAvailable?.options ?? {});
  const [qty, setQty] = useState(1);
  const [details, setDetails] = useState("");
  const [justAdded, setJustAdded] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(addedTimer.current), []);

  // On phones, a buy bar sticks to the bottom once the main buttons scroll out of view.
  const actionsRef = useRef<HTMLDivElement>(null);
  const [showBar, setShowBar] = useState(false);
  useEffect(() => {
    const el = actionsRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShowBar(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const match = (sel: Record<string, string>) => variants.find((v) => optionNames.every((n) => v.options[n] === sel[n]));
  const variant = match(selected);
  const alreadyInCart = inCart.find((i) => i.variantId === variant?.id)?.quantity ?? 0;
  const maxQty = Math.max(0, (variant?.stock ?? 0) - alreadyInCart);

  const pick = (name: string, value: string) => {
    const next = { ...selected, [name]: value };
    // If that exact combination doesn't exist, jump to the closest variant that has this value.
    const exact = match(next);
    const fallback = variants.find((v) => v.options[name] === value && v.stock > 0) ?? variants.find((v) => v.options[name] === value);
    setSelected(exact ? next : (fallback?.options ?? next));
    setQty(1);
  };

  const addToCart = (goToCart: boolean) => {
    if (!variant || maxQty < 1) return;
    add(
      {
        variantId: variant.id,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        options: variant.options,
        image: product.image,
        price: variant.price,
        stock: variant.stock,
        details: details.trim() || undefined,
      },
      Math.min(qty, maxQty),
    );
    if (goToCart) return router.push("/cart");
    toast.success("Added to cart", {
      description: product.name,
      action: { label: "View cart", onClick: () => router.push("/cart") },
    });
    setQty(1);
    setDetails("");
    setJustAdded(true);
    clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setJustAdded(false), 1600);
  };

  const price = variant?.price ?? Math.min(...variants.map((v) => v.price));
  const saving = compareAt && compareAt > price ? compareAt - price : 0;
  const savingPct = saving && compareAt ? Math.round((saving / compareAt) * 100) : 0;
  const canBuy = Boolean(variant) && maxQty > 0;
  const total = price * qty;
  const freeDelivery = shipping.freeOver != null && total >= shipping.freeOver;
  const stockNote = !variant
    ? null
    : variant.stock === 0
      ? { text: "Out of stock", tone: "bg-danger/10 text-danger", dot: "bg-danger" }
      : variant.stock <= 3
        ? { text: `Only ${variant.stock} left`, tone: "bg-warning/10 text-warning", dot: "bg-warning" }
        : { text: "In stock", tone: "bg-success/10 text-success", dot: "bg-success" };

  const addLabel = justAdded ? (
    <>
      <Check className="size-4" /> Added to cart
    </>
  ) : !variant || variant.stock === 0 ? (
    "Out of stock"
  ) : maxQty < 1 ? (
    "All stock is in your cart"
  ) : (
    <>
      <ShoppingBag className="size-4" /> Add to cart
    </>
  );

  return (
    <div className="grid gap-6">
      {/* Price */}
      <div className="rounded-2xl border border-line bg-surface/60 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <motion.span
                key={price}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="text-4xl font-semibold tracking-tight tabular-nums"
              >
                {formatBDT(price)}
              </motion.span>
              {saving > 0 && compareAt && <span className="text-lg text-ink-soft line-through tabular-nums">{formatBDT(compareAt)}</span>}
            </p>
            {saving > 0 && (
              <p className="mt-2 inline-flex items-center rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-white">
                Save {formatBDT(saving)} ({savingPct}% off)
              </p>
            )}
          </div>
          {stockNote && (
            <p className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold", stockNote.tone)}>
              <span className={cn("size-1.5 rounded-full", stockNote.dot)} aria-hidden />
              {stockNote.text}
            </p>
          )}
        </div>
        <p className="mt-3 text-sm text-ink-soft">Delivery charge is added at checkout.</p>
      </div>

      {/* Options */}
      {optionNames.map((name) => {
        const isColor = /^colou?r$/i.test(name.trim());
        return (
          <fieldset key={name}>
            <legend className="mb-3 text-sm">
              <span className="font-medium capitalize">{name}</span>
              <span className="text-ink-soft"> · {selected[name]}</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {valuesFor(name).map((value) => {
                const candidate = match({ ...selected, [name]: value });
                const out = candidate ? candidate.stock === 0 : !variants.some((v) => v.options[name] === value && v.stock > 0);
                const active = selected[name] === value;
                const hexKey = value.trim().toLowerCase();
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => pick(name, value)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-[border-color,box-shadow,background-color]",
                      active ? "border-accent bg-accent/5 text-ink ring-2 ring-accent/25" : "border-line bg-white hover:border-ink/40",
                      out && !active && "text-ink-soft/60 line-through",
                    )}
                  >
                    {isColor && hexKey in colorHex && <FilamentSwatch hex={colorHex[hexKey]} />}
                    {value}
                    {active && <Check className="size-3.5 text-accent" strokeWidth={2.5} />}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      {/* Optional details for personalised items */}
      <label className="block">
        <span className="text-sm font-medium">
          Details <span className="font-normal text-ink-soft">(optional)</span>
        </span>
        <textarea
          rows={2}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={DETAILS_MAX}
          placeholder="e.g. the name and number for a jersey"
          className="mt-2 block w-full resize-none rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none placeholder:text-ink-soft/60 focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <span className="mt-1.5 block text-xs text-ink-soft">Anything we should print or change on this item. You can edit it in the cart.</span>
      </label>

      {/* Quantity and total */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Quantity</span>
          <div className="flex h-11 items-center rounded-xl border border-line bg-white">
            <button type="button" className="grid h-full w-11 place-items-center text-ink-soft hover:text-ink disabled:opacity-30" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity">
              <Minus className="size-4" />
            </button>
            <span className="w-8 text-center font-medium tabular-nums" aria-live="polite">{qty}</span>
            <button type="button" className="grid h-full w-11 place-items-center text-ink-soft hover:text-ink disabled:opacity-30" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty} aria-label="Increase quantity">
              <Plus className="size-4" />
            </button>
          </div>
        </div>
        {canBuy && (
          <p className="text-sm text-ink-soft">
            Total <span className="ml-1 text-lg font-semibold text-ink tabular-nums">{formatBDT(total)}</span>
          </p>
        )}
      </div>

      {/* Buttons */}
      <div ref={actionsRef} className="grid gap-3 sm:grid-cols-2">
        <Button
          size="lg"
          variant="accent"
          className={cn("h-13 overflow-hidden shadow-sm shadow-accent/30", justAdded && "bg-success hover:bg-success", !canBuy && "sm:col-span-2")}
          onClick={() => addToCart(false)}
          disabled={!variant || (maxQty < 1 && !justAdded)}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={justAdded ? "added" : "label"}
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="inline-flex items-center gap-2"
            >
              {addLabel}
            </motion.span>
          </AnimatePresence>
        </Button>
        {canBuy && (
          <Button size="lg" className="h-13" onClick={() => addToCart(true)}>
            <Zap className="size-4" /> Buy now
          </Button>
        )}
      </div>

      {/* Delivery and payment */}
      <ul className="grid gap-3 rounded-2xl border border-line p-5 text-sm">
        <li className="flex gap-3">
          <Truck className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={1.75} />
          <div>
            <p className="font-medium">
              {freeDelivery
                ? "Free delivery on this order"
                : `Delivery: ${formatBDT(shipping.insideDhaka)} inside Dhaka, ${formatBDT(shipping.outsideDhaka)} outside`}
            </p>
            {shipping.freeOver != null && !freeDelivery && (
              <p className="mt-0.5 text-ink-soft">Free delivery on orders over {formatBDT(shipping.freeOver)}.</p>
            )}
          </div>
        </li>
        <li className="flex gap-3">
          <Banknote className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={1.75} />
          <p className="font-medium">Pay with bKash, Nagad, Rocket or cash on delivery</p>
        </li>
      </ul>

      {/* Sticky buy bar on phones */}
      <AnimatePresence>
        {showBar && canBuy && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgb(0_0_0/0.06)] backdrop-blur lg:hidden"
          >
            <div className="mx-auto flex max-w-7xl items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-ink-soft">{product.name}</p>
                <p className="text-lg leading-tight font-semibold tabular-nums">{formatBDT(total)}</p>
              </div>
              <Button variant="accent" size="lg" className={cn(justAdded && "bg-success hover:bg-success")} onClick={() => addToCart(false)}>
                {addLabel}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
