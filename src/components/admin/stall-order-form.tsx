"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createStallOrder } from "@/app/admin/stall/actions";
import { Button, Card, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { ProductImage } from "@/components/shop/product-image";
import { STALL_PAYMENT_METHODS, STALL_PICKUP_POINT } from "@/lib/stall";
import { cn, formatBDT } from "@/lib/utils";

type ItemRow = { key: number; name: string; details: string; quantity: string; price: string };
type ListProduct = { id: string; name: string; price: number; image: string | null };
const newRow = (key: number): ItemRow => ({ key, name: "", details: "", quantity: "1", price: "" });
const num = (v: string) => (v.trim() === "" ? 0 : Number(v));

/** What is typed for each customer. The stall location and date stay the same from one order to the next. */
const EMPTY_ORDER = {
  customerName: "",
  customerPhone: "",
  fulfilment: "pickup" as "pickup" | "delivery",
  deliveryAddress: "",
  deliveryCharge: "",
  discount: "",
  paidAmount: "",
  paymentMethod: "Cash",
  dueDate: "",
  note: "",
};

/**
 * The form used at the stall to take a custom order. Built to work on a phone.
 * Only what every order needs is shown; the rest sits under "More options".
 */
export function StallOrderForm({ today, lastLocation, products }: { today: string; lastLocation: string; products: ListProduct[] }) {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  // With a product list, the order starts empty and items are added by tapping products.
  const hasList = products.length > 0;
  const [items, setItems] = useState<ItemRow[]>(hasList ? [] : [newRow(0)]);
  const [nextKey, setNextKey] = useState(1);
  const [search, setSearch] = useState("");
  const [focusKey, setFocusKey] = useState<number | null>(null);
  const shownProducts = products.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));
  const hasPhotos = products.some((p) => p.image);

  /** Tap a product: one more piece if it is already in the order without details, otherwise a new line. */
  const addProduct = (p: ListProduct) => {
    const same = items.find((r) => r.name === p.name && !r.details.trim() && num(r.price) === p.price);
    if (same) {
      setItems((rows) => rows.map((r) => (r.key === same.key ? { ...r, quantity: String(num(r.quantity) + 1) } : r)));
      setFocusKey(same.key);
    } else {
      setItems((rows) => [...rows, { key: nextKey, name: p.name, details: "", quantity: "1", price: String(p.price) }]);
      setFocusKey(nextKey);
      setNextKey((k) => k + 1);
    }
    setSearch("");
  };
  const [f, setF] = useState({ ...EMPTY_ORDER, stallLocation: lastLocation, eventDate: today, sendToPrint: true });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((v) => ({ ...v, [k]: e.target.value }));
  const setItem = (key: number, k: keyof ItemRow, value: string) => setItems((rows) => rows.map((r) => (r.key === key ? { ...r, [k]: value } : r)));

  const subtotal = items.reduce((n, i) => n + num(i.price) * num(i.quantity), 0);
  const charge = f.fulfilment === "delivery" ? num(f.deliveryCharge) : 0;
  const total = Math.max(0, subtotal - num(f.discount) + charge);
  const paid = num(f.paidAmount);
  const due = Math.max(0, total - paid);

  /** `next` keeps the form open for the next customer instead of opening the saved order. */
  const save = (next: boolean) => {
    setError("");
    start(async () => {
      const res = await createStallOrder({
        customerName: f.customerName,
        customerPhone: f.customerPhone,
        stallLocation: f.stallLocation,
        eventDate: f.eventDate,
        fulfilment: f.fulfilment,
        deliveryAddress: f.deliveryAddress,
        deliveryCharge: charge,
        discount: num(f.discount),
        paidAmount: paid,
        paymentMethod: f.paymentMethod,
        dueDate: f.dueDate,
        note: f.note,
        sendToPrint: f.sendToPrint,
        items: items.map((i) => ({ name: i.name, details: i.details, quantity: num(i.quantity), unitPrice: i.price.trim() === "" ? -1 : Number(i.price) })),
      });
      if (res.error || !res.id) {
        setError(res.error ?? "Couldn't save the order");
        return void toast.error(res.error ?? "Couldn't save the order");
      }
      if (!next) {
        toast.success(`Order ${res.orderNumber} saved`);
        return void router.push(`/admin/stall/${res.id}`);
      }
      toast.success(`Order ${res.orderNumber} saved. Tell the customer this number.`, { duration: 10000 });
      setF((v) => ({ ...v, ...EMPTY_ORDER }));
      setItems(hasList ? [] : [newRow(nextKey)]);
      setNextKey((k) => k + 1);
      setSearch("");
      window.scrollTo({ top: 0 });
      nameRef.current?.focus();
    });
  };

  return (
    <form
      className="grid max-w-4xl gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        // Enter and the main button open the saved order; the other button passes next=true itself.
        save(((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "next");
      }}
    >
      <Card>
        <h2 className="font-semibold">1. Customer</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input ref={nameRef} value={f.customerName} onChange={set("customerName")} required maxLength={120} autoComplete="off" autoFocus />
          </Field>
          <Field label="Mobile number" hint="The customer uses this number to track the order.">
            <Input value={f.customerPhone} onChange={set("customerPhone")} required type="tel" inputMode="tel" placeholder="01XXXXXXXXX" autoComplete="off" />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold">2. Items</h2>
        {hasList ? (
          <div className="mt-4">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a product by name" className="pl-9" aria-label="Search products" autoComplete="off" />
            </div>
            <ul className="mt-3 grid max-h-80 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-line bg-surface p-2 sm:grid-cols-3 lg:grid-cols-4">
              {shownProducts.map((p) => {
                const inOrder = items.filter((r) => r.name === p.name).reduce((n, r) => n + num(r.quantity), 0);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => addProduct(p)}
                      className={cn(
                        "relative flex h-full w-full flex-col rounded-lg border bg-white p-2 text-left text-sm transition-colors hover:border-accent active:scale-[0.98]",
                        inOrder ? "border-accent ring-1 ring-accent" : "border-line",
                      )}
                    >
                      {hasPhotos && <ProductImage src={p.image} alt="" sizes="160px" className="mb-2 aspect-[4/3] w-full rounded-md" />}
                      <span className="line-clamp-2 font-medium break-words">{p.name}</span>
                      <span className="mt-auto pt-1 text-ink-soft tabular-nums">{formatBDT(p.price)}</span>
                      {inOrder > 0 && (
                        <span className="absolute top-1.5 right-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-accent px-1.5 text-xs font-semibold text-white tabular-nums">
                          {inOrder}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
              {!shownProducts.length && <li className="col-span-full px-3 py-6 text-center text-sm text-ink-soft">No product matches “{search}”.</li>}
            </ul>
            <p className="mt-2 text-xs text-ink-soft">
              Tap a product to add it. Tap again for one more.{" "}
              <Link href="/admin/stall/products" className="underline underline-offset-4 hover:text-ink">
                Edit the product list
              </Link>
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-soft">
            Tip: enter your products once in the{" "}
            <Link href="/admin/stall/products" className="font-medium text-ink underline underline-offset-4">
              product list
            </Link>
            , then you can add them here with one tap.
          </p>
        )}
        {hasList && items.length === 0 && <p className="mt-4 rounded-lg border border-dashed border-line px-4 py-5 text-center text-sm text-ink-soft">No items yet. Tap a product above.</p>}
        <ul className="mt-4 grid gap-4">
          {items.map((it, idx) => (
            <li key={it.key} className="grid grid-cols-2 gap-3 rounded-lg border border-line p-3 sm:grid-cols-[1fr_90px_120px_auto] sm:items-end">
              <Field label={items.length > 1 ? `Item ${idx + 1}` : "Item"} className="col-span-2 sm:col-span-1">
                <Input value={it.name} onChange={(e) => setItem(it.key, "name", e.target.value)} required maxLength={200} placeholder="e.g. Custom name keychain" />
              </Field>
              <Field label="Qty">
                <Input type="number" inputMode="numeric" min={1} max={9999} value={it.quantity} onChange={(e) => setItem(it.key, "quantity", e.target.value)} required />
              </Field>
              <Field label="Price each (৳)">
                <Input type="number" inputMode="decimal" min={0} step="any" value={it.price} onChange={(e) => setItem(it.key, "price", e.target.value)} required />
              </Field>
              {(items.length > 1 || hasList) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="order-last col-span-2 w-full text-ink-soft hover:text-danger sm:order-none sm:col-span-1 sm:w-10"
                  onClick={() => setItems((rows) => rows.filter((r) => r.key !== it.key))}
                  aria-label={`Remove item ${idx + 1}`}
                >
                  <Trash2 className="size-4" /> <span className="sm:hidden">Remove this item</span>
                </Button>
              )}
              <Field label="Details (name, number, color, size…)" className="col-span-2 sm:col-span-4">
                <Input
                  // A product that was just tapped gets the cursor here, ready for the details.
                  ref={it.key === focusKey ? (el) => el?.focus({ preventScroll: false }) : undefined}
                  value={it.details}
                  onChange={(e) => setItem(it.key, "details", e.target.value)}
                  onBlur={() => it.key === focusKey && setFocusKey(null)}
                  maxLength={500}
                  placeholder="e.g. Name: REZA, Number: 10, red"
                />
              </Field>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-4"
          disabled={items.length >= 50}
          onClick={() => {
            setItems((rows) => [...rows, newRow(nextKey)]);
            setNextKey((k) => k + 1);
          }}
        >
          <Plus className="size-4" /> {hasList ? "Add something not in the list" : "Add another item"}
        </Button>
      </Card>

      <Card>
        <h2 className="font-semibold">3. Payment</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Paid now (৳)" hint="Leave empty if nothing was paid.">
            <Input type="number" inputMode="decimal" min={0} step="any" value={f.paidAmount} onChange={set("paidAmount")} placeholder="0" />
          </Field>
          <Field label="Paid by">
            <Select value={f.paymentMethod} onChange={set("paymentMethod")} disabled={paid <= 0}>
              {STALL_PAYMENT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Field>
          <div className="col-span-2 flex items-end sm:col-span-1">
            <Button type="button" variant="secondary" className="w-full" disabled={total <= 0} onClick={() => setF((v) => ({ ...v, paidAmount: String(total) }))}>
              Paid in full
            </Button>
          </div>
        </div>
        <dl className="mt-5 grid gap-2 rounded-lg bg-surface p-4 text-sm">
          <Row label="Items" value={formatBDT(subtotal)} />
          {num(f.discount) > 0 && <Row label="Discount" value={`−${formatBDT(num(f.discount))}`} />}
          {charge > 0 && <Row label="Delivery" value={formatBDT(charge)} />}
          <Row label="Total" value={formatBDT(total)} strong />
          <Row label="Paid now" value={formatBDT(paid)} />
          <Row label="Still to pay" value={formatBDT(due)} strong danger={due > 0} />
        </dl>
      </Card>

      <details className="group rounded-xl border border-line bg-white shadow-xs" open={f.fulfilment === "delivery" || undefined}>
        <summary className="cursor-pointer px-5 py-4 font-semibold select-none">
          More options <span className="font-normal text-ink-soft">(home delivery, discount, promised date, note, stall)</span>
        </summary>
        <div className="grid gap-4 border-t border-line p-5 sm:grid-cols-2">
          <Field label="How does the customer get it?">
            <Select value={f.fulfilment} onChange={set("fulfilment")}>
              <option value="pickup">Customer collects it at {STALL_PICKUP_POINT}</option>
              <option value="delivery">Home delivery</option>
            </Select>
          </Field>
          <Field label="Discount (৳)">
            <Input type="number" inputMode="decimal" min={0} step="any" value={f.discount} onChange={set("discount")} placeholder="0" />
          </Field>
          {f.fulfilment === "delivery" && (
            <>
              <Field label="Delivery address" className="sm:col-span-2">
                <Textarea rows={2} value={f.deliveryAddress} onChange={set("deliveryAddress")} required maxLength={300} placeholder="House, road, area, district" />
              </Field>
              <Field label="Delivery charge (৳)">
                <Input type="number" inputMode="decimal" min={0} step="any" value={f.deliveryCharge} onChange={set("deliveryCharge")} placeholder="0" />
              </Field>
            </>
          )}
          <Field label="Promised date">
            <Input type="date" value={f.dueDate} min={f.eventDate} onChange={set("dueDate")} />
          </Field>
          <Field label="Note" className="sm:col-span-2">
            <Textarea rows={2} value={f.note} onChange={set("note")} maxLength={500} placeholder="Anything else to remember about this order" />
          </Field>
          <Field label="Stall location" hint="Stays the same for the next orders.">
            <Input value={f.stallLocation} onChange={set("stallLocation")} maxLength={120} placeholder="e.g. Dhanmondi Friday market" />
          </Field>
          <Field label="Stall date">
            <Input type="date" value={f.eventDate} max={today} onChange={set("eventDate")} required />
          </Field>
          <div className="sm:col-span-2">
            <Checkbox label="Put the items on the supplier's print list" checked={f.sendToPrint} onChange={(e) => setF((v) => ({ ...v, sendToPrint: e.target.checked }))} />
          </div>
        </div>
      </details>

      {error && (
        <p role="alert" className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-white px-4 py-3 sm:mx-0 sm:rounded-xl sm:border">
        <p className="text-sm">
          Total <span className="text-lg font-semibold tabular-nums">{formatBDT(total)}</span>
          {due > 0 && paid > 0 && <span className="text-ink-soft"> · {formatBDT(due)} still to pay</span>}
        </p>
        <div className="flex flex-1 flex-wrap justify-end gap-2">
          <Button type="submit" value="open" variant="secondary" size="lg" disabled={pending || items.length === 0}>
            Save &amp; open
          </Button>
          <Button type="submit" value="next" variant="accent" size="lg" disabled={pending || items.length === 0}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Save &amp; next customer
          </Button>
        </div>
      </div>
    </form>
  );
}

function Row({ label, value, strong, danger }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", strong && "font-semibold")}>
      <dt className={strong ? "" : "text-ink-soft"}>{label}</dt>
      <dd className={cn("tabular-nums", danger && "text-danger")}>{value}</dd>
    </div>
  );
}
