"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";
import { Check, Copy, Loader2, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import { EASE } from "@/components/motion";
import { cartSubtotal, useCart } from "@/lib/cart-store";
import { useCartSync } from "@/lib/use-cart-sync";
import { checkCoupon, placeOrder } from "@/app/(shop)/checkout/actions";
import { BD_DISTRICTS, type Zone } from "@/lib/bd";
import { Button, ButtonLink, Field, Input, Select, Textarea } from "@/components/ui";
import { ProductImage } from "./product-image";
import { cn, formatBDT, variantLabel } from "@/lib/utils";

type Wallet = "bkash" | "nagad" | "rocket";
type Payment = "cod" | Wallet;

type Address = { id: string; name: string; phone: string; district: string; area: string; line: string; zone: Zone; is_default: boolean };

type Props = {
  settings: {
    insideDhaka: number;
    outsideDhaka: number;
    freeOver: number | null;
    wallets: Record<Wallet, string | null>;
    instructions: string;
    codAdvance: "off" | "outside_dhaka" | "all";
  };
  signedIn: boolean;
  defaults: { name: string; phone: string; email: string };
  addresses: Address[];
};

const WALLET_INFO: Record<Wallet, { label: string; color: string }> = {
  bkash: { label: "bKash", color: "#E2136E" },
  nagad: { label: "Nagad", color: "#EC1C24" },
  rocket: { label: "Rocket", color: "#8C3494" },
};

export function CheckoutForm({ settings, signedIn, defaults, addresses }: Props) {
  const router = useRouter();
  const { ready, synced } = useCartSync();
  const items = useCart((s) => s.items);
  const clearCart = useCart((s) => s.clear);
  const [pending, start] = useTransition();
  const [checkingCoupon, startCoupon] = useTransition();

  const first = addresses[0];
  const [addressId, setAddressId] = useState<string>(first?.id ?? "new");
  const [form, setForm] = useState({
    name: first?.name ?? defaults.name,
    phone: first?.phone ?? defaults.phone,
    email: defaults.email,
    district: first?.district ?? "",
    area: first?.area ?? "",
    line: first?.line ?? "",
    note: "",
    sender: "",
    trx: "",
  });
  const [zone, setZone] = useState<Zone>(first?.zone ?? "inside_dhaka");
  const [payment, setPayment] = useState<Payment>("cod");
  const [advanceChoice, setAdvanceChoice] = useState<Wallet | null>(null);
  const [captcha, setCaptcha] = useState("");
  const captchaRef = useRef<TurnstileHandle>(null);
  const [saveAddress, setSaveAddress] = useState(signedIn && addresses.length === 0);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [placed, setPlaced] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: "" }));
  };

  const selectAddress = (id: string) => {
    setAddressId(id);
    const a = addresses.find((x) => x.id === id);
    if (a) {
      setForm((f) => ({ ...f, name: a.name, phone: a.phone, district: a.district, area: a.area, line: a.line }));
      setZone(a.zone);
    }
  };

  const subtotal = cartSubtotal(items);
  const discount = coupon ? Math.min(coupon.discount, subtotal) : 0;
  const shipping = useMemo(() => {
    if (settings.freeOver != null && subtotal - discount >= settings.freeOver) return 0;
    return zone === "inside_dhaka" ? settings.insideDhaka : settings.outsideDhaka;
  }, [zone, subtotal, discount, settings]);
  const total = subtotal - discount + shipping;
  const payload = () => items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity, details: i.details?.trim() || undefined }));

  const applyCoupon = () =>
    startCoupon(async () => {
      const res = await checkCoupon(couponInput, payload());
      if (res.error) {
        setCoupon(null);
        setErrors((e) => ({ ...e, coupon: res.error! }));
      } else {
        setCoupon({ code: couponInput.trim().toUpperCase(), discount: res.discount! });
        setErrors((e) => ({ ...e, coupon: "" }));
        toast.success("Coupon applied");
      }
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await placeOrder({
        items: payload(),
        ...form,
        zone,
        payment,
        advance: needAdvance ? advanceWallet : undefined,
        coupon: coupon?.code ?? "",
        saveAddress: signedIn && addressId === "new" && saveAddress,
        captcha,
      });
      if (!res.ok) {
        // A captcha token works once; get a fresh one for the next attempt.
        captchaRef.current?.reset();
        setCaptcha("");
        if (res.field) setErrors((er) => ({ ...er, [res.field!]: res.error }));
        toast.error(res.error);
        return;
      }
      setPlaced(true);
      router.replace(`/order/${res.orderNumber}?t=${res.token}`);
      clearCart();
    });
  };

  if (!ready || placed) {
    return (
      <div className="mt-16 flex justify-center">
        <Loader2 className="size-6 animate-spin text-ink-soft" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="mt-8 rounded-xl border border-dashed border-line px-6 py-16 text-center">
        <p className="font-medium">Your cart is empty</p>
        <ButtonLink href="/shop" className="mt-5">Continue shopping</ButtonLink>
      </div>
    );
  }

  const availableWallets = (Object.keys(WALLET_INFO) as Wallet[]).filter((w) => settings.wallets[w]);
  // Cash on delivery may require the delivery charge up front (set in Admin → Settings).
  const needAdvance =
    payment === "cod" &&
    shipping > 0 &&
    availableWallets.length > 0 &&
    (settings.codAdvance === "all" || (settings.codAdvance === "outside_dhaka" && zone === "outside_dhaka"));
  const advanceWallet = advanceChoice && availableWallets.includes(advanceChoice) ? advanceChoice : availableWallets[0];
  const wallet = payment !== "cod" ? payment : needAdvance ? advanceWallet : null;
  const payNow = payment !== "cod" ? total : needAdvance ? shipping : 0;

  return (
    <form onSubmit={submit} noValidate className="mt-8 grid gap-10 lg:grid-cols-[1fr_400px]">
      <div className="grid h-fit gap-10">
        {/* Contact */}
        <Section title="Contact" aside={!signedIn && <span className="text-sm text-ink-soft">Have an account? <Link href="/login?next=/checkout" className="font-medium text-ink underline underline-offset-4">Log in</Link></span>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" error={errors.name}>
              <Input value={form.name} onChange={set("name")} autoComplete="name" required />
            </Field>
            <Field label="Mobile number" error={errors.phone}>
              <Input value={form.phone} onChange={set("phone")} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" autoComplete="tel" required />
            </Field>
            <Field label="Email (optional)" error={errors.email} className="sm:col-span-2" hint="For your order receipt">
              <Input value={form.email} onChange={set("email")} type="email" autoComplete="email" />
            </Field>
          </div>
        </Section>

        {/* Delivery */}
        <Section title="Delivery address">
          {addresses.length > 0 && (
            <div className="mb-5 grid gap-2 sm:grid-cols-2">
              {addresses.map((a) => (
                <ChoiceCard key={a.id} checked={addressId === a.id} onSelect={() => selectAddress(a.id)} name="address">
                  <span className="text-sm font-medium">{a.name}</span>
                  <span className="block text-sm text-ink-soft">{a.line}, {a.area}, {a.district}</span>
                </ChoiceCard>
              ))}
              <ChoiceCard checked={addressId === "new"} onSelect={() => setAddressId("new")} name="address">
                <span className="text-sm font-medium">Use a new address</span>
              </ChoiceCard>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="District" error={errors.district}>
              <Select
                value={form.district}
                onChange={(e) => {
                  set("district")(e);
                  setZone(e.target.value === "Dhaka" ? "inside_dhaka" : "outside_dhaka");
                }}
                required
              >
                <option value="" disabled>Select district</option>
                {BD_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </Select>
            </Field>
            <Field label="Area / Thana" error={errors.area}>
              <Input value={form.area} onChange={set("area")} placeholder="e.g. Mirpur 10" required />
            </Field>
            <Field label="Street address" error={errors.line} className="sm:col-span-2">
              <Input value={form.line} onChange={set("line")} placeholder="House, road, block, landmark" autoComplete="street-address" required />
            </Field>
            <Field label="Order note (optional)" className="sm:col-span-2">
              <Textarea rows={2} value={form.note} onChange={set("note")} placeholder="Delivery instructions or anything we should know" />
            </Field>
          </div>
          {signedIn && addressId === "new" && (
            <label className="mt-4 inline-flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-accent" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
              Save this address to my account
            </label>
          )}
        </Section>

        {/* Shipping */}
        <Section title="Delivery area">
          <div className="grid gap-2 sm:grid-cols-2">
            {(["inside_dhaka", "outside_dhaka"] as const).map((z) => (
              <ChoiceCard key={z} checked={zone === z} onSelect={() => setZone(z)} name="zone">
                <span className="flex w-full justify-between text-sm">
                  <span className="font-medium">{z === "inside_dhaka" ? "Inside Dhaka" : "Outside Dhaka"}</span>
                  <span className="tabular-nums">{formatBDT(z === "inside_dhaka" ? settings.insideDhaka : settings.outsideDhaka)}</span>
                </span>
                <span className="block text-sm text-ink-soft">{z === "inside_dhaka" ? "Usually 1–2 days" : "Usually 2–4 days"}</span>
              </ChoiceCard>
            ))}
          </div>
          {settings.freeOver != null && (
            <p className="mt-3 text-sm text-ink-soft">Free delivery on orders over {formatBDT(settings.freeOver)}.</p>
          )}
        </Section>

        {/* Payment */}
        <Section title="Payment">
          <div className="grid gap-2 sm:grid-cols-2">
            <ChoiceCard checked={payment === "cod"} onSelect={() => setPayment("cod")} name="payment">
              <span className="text-sm font-medium">Cash on delivery</span>
              <span className="block text-sm text-ink-soft">
                {needAdvance ? `Pay ${formatBDT(shipping)} delivery charge now, the rest on delivery` : "Pay when you receive it"}
              </span>
            </ChoiceCard>
            {availableWallets.map((w) => (
                <ChoiceCard key={w} checked={payment === w} onSelect={() => setPayment(w)} name="payment">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span className="size-2.5 rounded-full" style={{ background: WALLET_INFO[w].color }} aria-hidden />
                    {WALLET_INFO[w].label}
                  </span>
                  <span className="block text-sm text-ink-soft">Send Money, then enter the TrxID</span>
                </ChoiceCard>
              ))}
          </div>

          <AnimatePresence initial={false}>
          {wallet && (
            <motion.div
              key="wallet"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="overflow-hidden"
            >
            <motion.div
              key={wallet}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="mt-5 rounded-xl border border-line bg-surface p-5"
            >
              {payment === "cod" && (
                <div className="mb-5 border-b border-line pb-5">
                  <p className="text-sm font-medium">Delivery charge in advance</p>
                  <p className="mt-1 text-sm text-ink-soft">
                    To keep cash on delivery available for everyone, we ask for the {formatBDT(shipping)} delivery charge
                    up front. You&apos;ll pay the remaining {formatBDT(total - shipping)} when your order arrives.
                  </p>
                  {availableWallets.length > 1 && (
                    <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Pay delivery charge with">
                      {availableWallets.map((w) => (
                        <button
                          key={w}
                          type="button"
                          role="radio"
                          aria-checked={advanceWallet === w}
                          onClick={() => setAdvanceChoice(w)}
                          className={cn(
                            "inline-flex h-9 items-center gap-2 rounded-lg border bg-white px-3 text-sm font-medium transition-colors",
                            advanceWallet === w ? "border-ink ring-1 ring-ink" : "border-line hover:border-ink/30",
                          )}
                        >
                          <span className="size-2.5 rounded-full" style={{ background: WALLET_INFO[w].color }} aria-hidden />
                          {WALLET_INFO[w].label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <ol className="grid gap-3 text-sm">
                <li className="flex gap-3">
                  <Step n={1} />
                  <span>
                    Open your {WALLET_INFO[wallet].label} app and choose <strong>Send Money</strong>.
                  </span>
                </li>
                <li className="flex gap-3">
                  <Step n={2} />
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    Send <strong className="tabular-nums">{formatBDT(payNow)}</strong> to
                    <CopyChip value={settings.wallets[wallet]!} />
                  </span>
                </li>
                <li className="flex gap-3">
                  <Step n={3} />
                  <span>Enter the number you sent from and the Transaction ID (TrxID) below.</span>
                </li>
              </ol>
              {settings.instructions && <p className="mt-4 text-xs text-ink-soft">{settings.instructions}</p>}
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Your sender number" error={errors.sender}>
                  <Input value={form.sender} onChange={set("sender")} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" />
                </Field>
                <Field label="Transaction ID (TrxID)" error={errors.trx}>
                  <Input value={form.trx} onChange={set("trx")} placeholder="e.g. 9A7B3C2D1E" className="font-mono uppercase" autoCapitalize="characters" />
                </Field>
              </div>
              <p className="mt-3 text-xs text-ink-soft">We&apos;ll confirm your order once we verify the payment.</p>
            </motion.div>
            </motion.div>
          )}
          </AnimatePresence>
        </Section>
      </div>

      {/* Summary */}
      <aside className="h-fit rounded-xl bg-surface p-6 lg:sticky lg:top-24" aria-labelledby="summary">
        <h2 id="summary" className="font-semibold">Order summary</h2>
        <ul className="mt-5 grid gap-4">
          {items.map((i) => (
            <li key={i.variantId} className="flex items-center gap-3">
              <div className="relative shrink-0">
                <ProductImage src={i.image} alt={i.name} sizes="56px" className="size-14 rounded-lg border border-line" />
                <span className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[11px] font-medium text-white">
                  {i.quantity}
                </span>
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium">{i.name}</p>
                {variantLabel(i.options) && <p className="text-ink-soft">{variantLabel(i.options)}</p>}
                {i.details?.trim() && <p className="mt-0.5 break-words text-ink-soft">Details: {i.details.trim()}</p>}
              </div>
              <span className="text-sm tabular-nums">{formatBDT(i.price * i.quantity)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 border-t border-line pt-5">
          {coupon ? (
            <div className="flex items-center justify-between rounded-lg border border-success/25 bg-success/5 px-3 py-2 text-sm">
              <span className="flex items-center gap-2 font-medium text-success">
                <Check className="size-4" /> {coupon.code}
              </span>
              <button type="button" onClick={() => setCoupon(null)} className="text-ink-soft hover:text-ink" aria-label="Remove coupon">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <div>
              <div className="flex gap-2">
                <Input
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value);
                    setErrors((er) => ({ ...er, coupon: "" }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyCoupon();
                    }
                  }}
                  placeholder="Coupon code"
                  aria-label="Coupon code"
                  className="uppercase"
                />
                <Button type="button" variant="secondary" onClick={applyCoupon} disabled={checkingCoupon || !couponInput.trim()}>
                  {checkingCoupon ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
                </Button>
              </div>
              {errors.coupon && <p className="mt-1.5 text-sm text-danger" role="alert">{errors.coupon}</p>}
            </div>
          )}
        </div>

        <dl className="mt-5 grid gap-2.5 border-t border-line pt-5 text-sm">
          <Row label="Subtotal" value={formatBDT(subtotal)} />
          {discount > 0 && <Row label="Discount" value={`−${formatBDT(discount)}`} className="text-success" />}
          <Row label={`Delivery (${zone === "inside_dhaka" ? "Inside Dhaka" : "Outside Dhaka"})`} value={shipping === 0 ? "Free" : formatBDT(shipping)} />
          <div className="mt-2 flex justify-between border-t border-line pt-4 text-base">
            <dt className="font-medium">Total</dt>
            <dd className="font-semibold tabular-nums">{formatBDT(total)}</dd>
          </div>
          {needAdvance && (
            <>
              <Row label="Pay now (delivery charge)" value={formatBDT(shipping)} />
              <Row label="Pay on delivery" value={formatBDT(total - shipping)} />
            </>
          )}
        </dl>

        <Turnstile ref={captchaRef} onToken={setCaptcha} className="mt-6" />

        <Button type="submit" size="lg" className="mt-6 w-full" disabled={pending || !synced}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
          {pending ? "Placing order…" : wallet ? "Confirm payment & place order" : "Place order"}
        </Button>
        <p className="mt-3 text-center text-xs text-ink-soft">
          By placing your order you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-ink">Terms</Link> and{" "}
          <Link href="/refund-policy" className="underline underline-offset-2 hover:text-ink">Return &amp; Refund Policy</Link>.
        </p>
      </aside>
    </form>
  );
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function ChoiceCard({ checked, onSelect, name, children }: { checked: boolean; onSelect: () => void; name: string; children: React.ReactNode }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-3 rounded-lg border bg-white p-4 transition-colors",
        checked ? "border-ink ring-1 ring-ink" : "border-line hover:border-ink/30",
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="mt-0.5 size-4 shrink-0 accent-ink" />
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}

function Step({ n }: { n: number }) {
  return <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-xs font-medium ring-1 ring-line">{n}</span>;
}

function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-0.5 font-mono font-medium ring-1 ring-line hover:ring-ink/30"
      aria-label={`Copy ${value}`}
    >
      {value}
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5 text-ink-soft" />}
    </button>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex justify-between", className)}>
      <dt className={className ? undefined : "text-ink-soft"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
