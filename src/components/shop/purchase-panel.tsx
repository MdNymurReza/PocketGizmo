"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Banknote, Bell, Check, Clock, Gift, Loader2, Minus, Plus, ShoppingBag, Tag, Truck, Zap } from "lucide-react";
import { toast } from "sonner";
import { DETAILS_MAX, PREORDER_MAX, useCart } from "@/lib/cart-store";
import { createClient } from "@/lib/supabase/client";
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
  preorder = null,
  deals = [],
  pointsPer = null,
}: {
  product: { id: string; slug: string; name: string; image: string | null };
  variants: Variant[];
  compareAt: number | null;
  shipping: { insideDhaka: number; outsideDhaka: number; freeOver: number | null };
  /** Lower-cased color name to hex, from the filament list. Used to show color dots. */
  colorHex?: Record<string, string | null>;
  /** Set when the product can be ordered while out of stock. */
  preorder?: { note: string | null } | null;
  deals?: { id: string; name: string; rule: string }[];
  /** Taka spent per loyalty point, when points are on. */
  pointsPer?: number | null;
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

  const match = (sel: Record<string, string>) => variants.find((v) => optionNames.every((n) => v.options[n] === sel[n]));
  const variant = match(selected);
  const alreadyInCart = inCart.find((i) => i.variantId === variant?.id)?.quantity ?? 0;
  // Pre-order products can be ordered past their stock; the rest is printed after the order.
  const limit = preorder ? Math.max(variant?.stock ?? 0, PREORDER_MAX) : (variant?.stock ?? 0);
  const maxQty = Math.max(0, limit - alreadyInCart);
  const isPreorder = Boolean(preorder && variant && variant.stock < qty + alreadyInCart);

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
        stock: limit,
        preorder: Boolean(preorder) || undefined,
        ready: preorder ? variant.stock : undefined,
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
    : variant.stock === 0 && preorder
      ? { text: "Available to pre-order", tone: "bg-info/10 text-info", dot: "bg-info" }
      : variant.stock === 0
      ? { text: "Out of stock", tone: "bg-danger/10 text-danger", dot: "bg-danger" }
      : variant.stock <= 3
        ? { text: `Only ${variant.stock} left`, tone: "bg-warning/10 text-warning", dot: "bg-warning" }
        : { text: "In stock", tone: "bg-success/10 text-success", dot: "bg-success" };

  const addLabel = justAdded ? (
    <>
      <Check className="size-4" /> Added to cart
    </>
  ) : !variant || (variant.stock === 0 && !preorder) ? (
    "Out of stock"
  ) : maxQty < 1 ? (
    "All stock is in your cart"
  ) : (
    <>
      {isPreorder ? <Clock className="size-4" /> : <ShoppingBag className="size-4" />} {isPreorder ? "Pre-order" : "Add to cart"}
    </>
  );

  return (
    <div className="@container grid min-w-0 gap-6">
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
                className="text-3xl font-semibold tracking-tight tabular-nums"
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
        {deals.length > 0 && (
          <ul className="mt-4 grid gap-2">
            {deals.map((d) => (
              <li key={d.id} className="flex items-start gap-2 rounded-lg border border-accent/25 bg-accent/5 px-3 py-2 text-sm">
                <Tag className="mt-0.5 size-4 shrink-0 text-accent" />
                <span>
                  <span className="font-semibold">{d.rule}</span>
                  {d.name !== d.rule && <span className="text-ink-soft"> · {d.name}</span>}
                  <span className="block text-xs text-ink-soft">Mix and match. The discount is added in your cart automatically.</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm text-ink-soft">Delivery charge is added at checkout.</p>
      </div>
      {preorder && variant && (variant.stock === 0 || isPreorder) && (
        <p className="-mt-2 flex items-start gap-2 rounded-xl bg-info/5 px-4 py-3 text-sm text-ink-soft">
          <Clock className="mt-0.5 size-4 shrink-0 text-info" />
          <span>
            <span className="font-medium text-ink">Pre-order: </span>
            {variant.stock > 0 ? `Only ${variant.stock} ready now. The rest is printed for you` : "We print this for you after you order"}
            {preorder.note ? ` · ${preorder.note}` : "."}
          </span>
        </p>
      )}

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
          <p className="text-right text-sm text-ink-soft">
            Total <span className="ml-1 text-lg font-semibold text-ink tabular-nums">{formatBDT(total)}</span>
            {pointsPer && Math.floor(total / pointsPer) > 0 && (
              <span className="mt-0.5 flex items-center justify-end gap-1 text-xs">
                <Gift className="size-3.5 text-accent" /> Earn {Math.floor(total / pointsPer)} points
              </span>
            )}
          </p>
        )}
      </div>

      {/* Buttons */}
      <div className="grid gap-3 @sm:grid-cols-2">
        <Button
          size="lg"
          variant="accent"
          className={cn("h-12 w-full min-w-0 overflow-hidden px-4 shadow-sm shadow-accent/30", justAdded && "bg-success hover:bg-success", !canBuy && "@sm:col-span-2")}
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
          <Button size="lg" className="h-12 w-full min-w-0 px-4" onClick={() => addToCart(true)}>
            <Zap className="size-4" /> Buy now
          </Button>
        )}
      </div>

      {variant && variant.stock === 0 && !preorder && <StockAlert variantId={variant.id} key={variant.id} />}

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
    </div>
  );
}

/** "Text me when it's back": saves the phone number for a back-in-stock SMS. */
function StockAlert({ variantId }: { variantId: string }) {
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^(?:\+?88)?01[3-9]\d{8}$/.test(phone.replace(/[\s-]/g, ""))) return setError("Enter a valid mobile number (01XXXXXXXXX)");
    setState("saving");
    const { error: err } = await createClient().rpc("request_stock_alert", { p_variant: variantId, p_phone: phone });
    if (err) {
      setState("idle");
      return setError(/valid mobile|not available|many items/i.test(err.message) ? err.message : "Couldn't save that, please try again");
    }
    setState("done");
  };

  if (state === "done") {
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-success/25 bg-success/5 p-4 text-sm">
        <Check className="size-4 text-success" /> Done. We&apos;ll text you as soon as it&apos;s back in stock.
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="rounded-2xl border border-line p-4" noValidate>
      <p className="flex items-center gap-2 text-sm font-medium">
        <Bell className="size-4 text-accent" /> Get an SMS when it&apos;s back
      </p>
      <div className="mt-3 flex gap-2">
        <input
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="01XXXXXXXXX"
          aria-label="Mobile number"
          className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-3.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <Button type="submit" variant="secondary" className="h-11" disabled={state === "saving"}>
          {state === "saving" ? <Loader2 className="size-4 animate-spin" /> : "Notify me"}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
    </form>
  );
}
