"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart-store";
import { Button } from "@/components/ui";
import { cn, formatBDT } from "@/lib/utils";

type Variant = { id: string; options: Record<string, string>; price: number; stock: number };

export function PurchasePanel({
  product,
  variants,
  compareAt,
}: {
  product: { id: string; slug: string; name: string; image: string | null };
  variants: Variant[];
  compareAt: number | null;
}) {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const inCart = useCart((s) => s.items);

  const optionNames = useMemo(() => [...new Set(variants.flatMap((v) => Object.keys(v.options)))], [variants]);
  const valuesFor = (name: string) => [...new Set(variants.map((v) => v.options[name]).filter(Boolean))];

  const firstAvailable = variants.find((v) => v.stock > 0) ?? variants[0];
  const [selected, setSelected] = useState<Record<string, string>>(firstAvailable?.options ?? {});
  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(addedTimer.current), []);

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
      },
      Math.min(qty, maxQty),
    );
    if (goToCart) return router.push("/cart");
    toast.success("Added to cart", {
      description: product.name,
      action: { label: "View cart", onClick: () => router.push("/cart") },
    });
    setQty(1);
    setJustAdded(true);
    clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setJustAdded(false), 1600);
  };

  const price = variant?.price ?? Math.min(...variants.map((v) => v.price));
  const stockNote = !variant
    ? null
    : variant.stock === 0
      ? { text: "Out of stock", tone: "text-danger", dot: "bg-danger" }
      : variant.stock <= 3
        ? { text: `Only ${variant.stock} left in stock`, tone: "text-warning", dot: "bg-warning" }
        : { text: "In stock, ready to ship", tone: "text-success", dot: "bg-success" };

  return (
    <div className="grid gap-7">
      <div>
        <p className="flex items-baseline gap-3">
          <motion.span
            key={price}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="text-2xl font-semibold tabular-nums"
          >
            {formatBDT(price)}
          </motion.span>
          {compareAt && compareAt > price && <span className="text-ink-soft line-through">{formatBDT(compareAt)}</span>}
        </p>
        {stockNote && (
          <p className={cn("mt-2 flex items-center gap-2 text-sm font-medium", stockNote.tone)}>
            <span className={cn("size-2 rounded-full", stockNote.dot)} aria-hidden />
            {stockNote.text}
          </p>
        )}
      </div>

      {optionNames.map((name) => (
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
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => pick(name, value)}
                  aria-pressed={active}
                  className={cn(
                    "h-10 rounded-lg border px-4 text-sm font-medium transition-colors",
                    active ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/40",
                    out && !active && "text-ink-soft/60 line-through",
                  )}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="grid gap-3">
        <div className="flex gap-3">
          <div className="flex h-12 items-center rounded-lg border border-line">
            <button type="button" className="grid h-full w-11 place-items-center text-ink-soft hover:text-ink disabled:opacity-30" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity">
              <Minus className="size-4" />
            </button>
            <span className="w-8 text-center font-medium tabular-nums" aria-live="polite">{qty}</span>
            <button type="button" className="grid h-full w-11 place-items-center text-ink-soft hover:text-ink disabled:opacity-30" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty} aria-label="Increase quantity">
              <Plus className="size-4" />
            </button>
          </div>
          <Button
            size="lg"
            className={cn("flex-1 overflow-hidden", justAdded && "bg-success hover:bg-success")}
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
                {justAdded ? (
                  <>
                    <Check className="size-4" /> Added to cart
                  </>
                ) : !variant || variant.stock === 0 ? (
                  "Out of stock"
                ) : maxQty < 1 ? (
                  "All stock is in your cart"
                ) : (
                  "Add to cart"
                )}
              </motion.span>
            </AnimatePresence>
          </Button>
        </div>
        {variant && maxQty > 0 && (
          <Button variant="secondary" size="lg" onClick={() => addToCart(true)}>
            Buy now
          </Button>
        )}
      </div>
    </div>
  );
}
