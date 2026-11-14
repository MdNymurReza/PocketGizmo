"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CloudOff, CloudUpload, Loader2, Plus, RefreshCw, Search, Trash2, Undo2, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { BD_PHONE_RE, normalizePhone } from "@/lib/bd";
import { STALL_PAYMENT_METHODS, STALL_PICKUP_POINT, dhakaToday } from "@/lib/stall";
import { cn, formatBDT } from "@/lib/utils";

// ---------------------------------------------------------------------------
// What is kept on the device (in the browser's storage)
// ---------------------------------------------------------------------------
type Product = { id: string; name: string; price: number };
type Item = { name: string; details: string; quantity: number; unitPrice: number };
type LocalOrder = {
  clientId: string;
  orderNumber: string;
  createdAt: string;
  eventDate: string;
  stallLocation: string;
  customerName: string;
  customerPhone: string;
  fulfilment: "pickup" | "delivery";
  deliveryAddress: string;
  deliveryCharge: number;
  discount: number;
  paidAmount: number;
  paymentMethod: string;
  note: string;
  sendToPrint: boolean;
  items: Item[];
  total: number;
  delivered: boolean;
  /** Uploaded to the website. */
  synced: boolean;
  error?: string;
};
/** An open order from the website (taken on any device), as it was at the last sync. */
type RemoteOrder = { orderNumber: string; customerName: string; customerPhone: string; total: number; paid: number; status: string; items: string };
/** An order handed over while offline, waiting to be uploaded. prevPaid lets it be undone. */
type Delivery = { orderNumber: string; collect: boolean; prevPaid: number };
type Store = {
  /** Two letters that make this device's order numbers different from other devices'. */
  device: string;
  counter: number;
  products: Product[];
  orders: LocalOrder[];
  remote: RemoteOrder[];
  deliveries: Delivery[];
  lastSync: string | null;
};

const KEY = "pg-stall-v1";
const LETTERS = "ABCDEFGHJKLMNPRSTUVWXYZ";
const randomLetters = () => Array.from({ length: 2 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join("");
const emptyStore = (): Store => ({ device: randomLetters(), counter: 1, products: [], orders: [], remote: [], deliveries: [], lastSync: null });

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...emptyStore(), ...(JSON.parse(raw) as Partial<Store>) };
  } catch {
    // Storage is empty or unreadable: start fresh.
  }
  return emptyStore();
}

const num = (v: string) => (v.trim() === "" ? 0 : Number(v));
const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// The app
// ---------------------------------------------------------------------------
export function StallApp() {
  const [store, setStore] = useState<Store | null>(null);
  const storeRef = useRef<Store | null>(null);
  const [tab, setTab] = useState<"new" | "orders">("new");
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);

  /** Change what is kept on the device. Every change is written to storage at once, so nothing is lost if the page closes. */
  const update = useCallback((fn: (s: Store) => Store) => {
    const next = fn(storeRef.current ?? loadStore());
    storeRef.current = next;
    setStore(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      toast.error("This device's storage is full. Sync, then clear old orders.");
    }
  }, []);

  useEffect(() => {
    update((s) => s);
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    // Keep a copy of the app on the device, so it opens without internet. (Not while developing.)
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/stall-sw.js", { scope: "/stall" })
        .then(() => navigator.serviceWorker.ready)
        .then((reg) => {
          const urls = [
            ...Array.from(document.querySelectorAll<HTMLScriptElement>("script[src]")).map((s) => s.src),
            ...Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]')).map((l) => l.href),
            ...performance.getEntriesByType("resource").map((e) => e.name),
          ].filter((u) => u.startsWith(location.origin) && u.includes("/_next/static/"));
          reg.active?.postMessage({ type: "precache", urls: [...new Set(urls)] });
        })
        .catch(() => undefined);
    }
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [update]);

  const sync = useCallback(async () => {
    const s = storeRef.current;
    if (!s || syncing) return;
    setSyncing(true);
    setNeedLogin(false);
    try {
      const pending = s.orders.filter((o) => !o.synced);
      const res = await fetch("/api/stall/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders: pending, deliveries: s.deliveries.map(({ orderNumber, collect }) => ({ orderNumber, collect })) }),
      });
      if (res.status === 401) {
        setNeedLogin(true);
        return void toast.error("Log in as the admin, then press Sync again.");
      }
      if (!res.ok) throw new Error("upload failed");
      const out = (await res.json()) as {
        orders: { clientId: string; ok: boolean; orderNumber?: string; error?: string }[];
        deliveries: { orderNumber: string; ok: boolean; error?: string }[];
      };
      const renamed: string[] = [];
      update((cur) => {
        const byId = new Map(out.orders.map((r) => [r.clientId, r]));
        const done = new Set(out.deliveries.filter((d) => d.ok).map((d) => d.orderNumber));
        return {
          ...cur,
          orders: cur.orders.map((o) => {
            const r = byId.get(o.clientId);
            if (!r) return o;
            if (!r.ok) return { ...o, error: r.error ?? "Could not be uploaded" };
            if (r.orderNumber && r.orderNumber !== o.orderNumber) renamed.push(`${o.orderNumber} → ${r.orderNumber}`);
            return { ...o, synced: true, error: undefined, orderNumber: r.orderNumber ?? o.orderNumber };
          }),
          deliveries: cur.deliveries.filter((d) => !done.has(d.orderNumber)),
        };
      });

      // Then bring the product list and the open orders up to date.
      const data = await fetch("/api/stall/data", { cache: "no-store" });
      if (data.ok) {
        const d = (await data.json()) as { products: Product[]; orders: RemoteOrder[] };
        update((cur) => ({ ...cur, products: d.products, remote: d.orders, lastSync: new Date().toISOString() }));
      }

      const failed = out.orders.filter((r) => !r.ok).length + out.deliveries.filter((d) => !d.ok).length;
      if (renamed.length) toast.warning(`Number already used by another device, changed: ${renamed.join(", ")}`, { duration: 15000 });
      if (failed) toast.error(`${failed} ${failed === 1 ? "entry" : "entries"} could not be uploaded. Look for the red notes in Orders.`);
      else toast.success("Everything is uploaded");
    } catch {
      toast.error("No connection. Your orders are safe on this device. Press Sync when you have internet.");
    } finally {
      setSyncing(false);
    }
  }, [syncing, update]);

  if (!store) {
    return (
      <div className="grid min-h-dvh place-items-center text-ink-soft">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  const waiting = store.orders.filter((o) => !o.synced).length + store.deliveries.length;

  return (
    <div className="min-h-dvh bg-surface">
      <header className="sticky top-0 z-10 border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <p className="font-semibold">PocketGizmo Stall</p>
          <Badge color={online ? "success" : "warning"}>
            {online ? <Wifi className="size-3" /> : <CloudOff className="size-3" />} {online ? "Online" : "Offline"}
          </Badge>
          <div className="ml-auto flex items-center gap-2">
            {waiting > 0 && <span className="text-sm font-medium text-warning">{waiting} not uploaded</span>}
            <Button size="sm" variant={waiting > 0 ? "accent" : "secondary"} disabled={syncing} onClick={sync}>
              {syncing ? <Loader2 className="size-4 animate-spin" /> : waiting > 0 ? <CloudUpload className="size-4" /> : <RefreshCw className="size-4" />}
              Sync
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 px-4 pb-2" aria-label="Stall app">
          {(["new", "orders"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-current={tab === t ? "page" : undefined}
              className={cn("flex-1 rounded-lg px-3 py-2 text-sm font-medium", tab === t ? "bg-ink text-white" : "text-ink-soft hover:bg-surface")}
            >
              {t === "new" ? "New order" : `Orders (${store.orders.length + store.remote.filter((r) => !store.orders.some((o) => o.orderNumber === r.orderNumber)).length})`}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">
        {needLogin && (
          <p className="mb-4 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
            You are not logged in.{" "}
            <a href="/login?next=/stall" className="font-medium underline underline-offset-4">
              Log in as the admin
            </a>
            , then press Sync. Your orders stay on this device until then.
          </p>
        )}
        {!store.lastSync && store.products.length === 0 && (
          <p className="mb-4 rounded-lg border border-line bg-white px-4 py-3 text-sm">
            First time on this device: press <span className="font-medium">Sync</span> once while you have internet. That loads your product list, and after it the app works
            without internet.
          </p>
        )}
        {tab === "new" ? <NewOrder store={store} update={update} /> : <OrderList store={store} update={update} />}
        <p className="mt-8 text-center text-xs text-ink-soft">
          This device&apos;s order numbers start with ST-{store.device}.{" "}
          {store.lastSync ? `Last sync: ${new Date(store.lastSync).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.` : "Not synced yet."}
        </p>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// New order
// ---------------------------------------------------------------------------
type Row = { key: number; name: string; details: string; quantity: string; price: string };
const EMPTY = { name: "", phone: "", delivery: false, address: "", charge: "", discount: "", paid: "", method: "Cash", note: "", tookNow: false };

function NewOrder({ store, update }: { store: Store; update: (fn: (s: Store) => Store) => void }) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState(EMPTY);
  const [rows, setRows] = useState<Row[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [search, setSearch] = useState("");
  const [focusKey, setFocusKey] = useState<number | null>(null);
  const [saved, setSaved] = useState<{ number: string; total: number; due: number } | null>(null);
  const [error, setError] = useState("");
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((v) => ({ ...v, [k]: e.target.value }));
  const setRow = (key: number, k: keyof Row, value: string) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [k]: value } : r)));

  const shown = store.products.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));
  const subtotal = rows.reduce((n, r) => n + num(r.price) * num(r.quantity), 0);
  const charge = f.delivery ? num(f.charge) : 0;
  const total = round2(Math.max(0, subtotal - num(f.discount) + charge));
  const paid = f.tookNow ? total : num(f.paid);
  const due = round2(Math.max(0, total - paid));

  const addProduct = (p: Product) => {
    const same = rows.find((r) => r.name === p.name && !r.details.trim() && num(r.price) === p.price);
    if (same) {
      setRows((rs) => rs.map((r) => (r.key === same.key ? { ...r, quantity: String(num(r.quantity) + 1) } : r)));
      setFocusKey(same.key);
    } else {
      setRows((rs) => [...rs, { key: nextKey, name: p.name, details: "", quantity: "1", price: String(p.price) }]);
      setFocusKey(nextKey);
      setNextKey((k) => k + 1);
    }
    setSearch("");
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const phone = normalizePhone(f.phone);
    const fail = (msg: string) => {
      setError(msg);
      toast.error(msg);
    };
    if (f.name.trim().length < 2) return fail("Enter the customer's name");
    if (!BD_PHONE_RE.test(phone)) return fail("Enter an 11-digit mobile number, e.g. 01712345678");
    if (!rows.length) return fail("Add at least one item");
    if (rows.some((r) => !r.name.trim() || num(r.quantity) < 1 || r.price.trim() === "" || num(r.price) < 0)) return fail("Every item needs a name, a quantity and a price");
    if (num(f.discount) > subtotal) return fail("The discount cannot be more than the items total");
    if (paid > total) return fail("The amount paid cannot be more than the total");
    if (f.delivery && !f.address.trim()) return fail("Enter the delivery address");
    setError("");

    const orderNumber = `ST-${store.device}${store.counter}`;
    const order: LocalOrder = {
      clientId: crypto.randomUUID(),
      orderNumber,
      createdAt: new Date().toISOString(),
      eventDate: dhakaToday(),
      stallLocation: STALL_PICKUP_POINT,
      customerName: f.name.trim(),
      customerPhone: phone,
      fulfilment: f.delivery ? "delivery" : "pickup",
      deliveryAddress: f.delivery ? f.address.trim() : "",
      deliveryCharge: charge,
      discount: num(f.discount),
      paidAmount: round2(paid),
      paymentMethod: f.method,
      note: f.note.trim(),
      // Something the customer takes home now was not printed to order.
      sendToPrint: !f.tookNow,
      items: rows.map((r) => ({ name: r.name.trim(), details: r.details.trim(), quantity: num(r.quantity), unitPrice: round2(num(r.price)) })),
      total,
      delivered: f.tookNow,
      synced: false,
    };
    update((s) => ({
      ...s,
      counter: s.counter + 1,
      orders: [order, ...s.orders],
      deliveries: f.tookNow ? [...s.deliveries, { orderNumber, collect: false, prevPaid: order.paidAmount }] : s.deliveries,
    }));
    setSaved({ number: orderNumber, total, due });
    setF(EMPTY);
    setRows([]);
    setSearch("");
    window.scrollTo({ top: 0 });
    nameRef.current?.focus();
  };

  return (
    <form onSubmit={save} className="grid gap-4">
      {saved && (
        <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-3">
          <p className="text-sm text-ink-soft">Saved on this device. Tell the customer this number:</p>
          <p className="text-2xl font-semibold tracking-wide">{saved.number}</p>
          <p className="text-sm">
            Total {formatBDT(saved.total)}
            {saved.due > 0 ? `, ${formatBDT(saved.due)} still to pay` : ", paid in full"}. Pickup: {STALL_PICKUP_POINT}.
          </p>
        </div>
      )}

      <section className="rounded-xl border border-line bg-white p-4">
        <h2 className="font-semibold">1. Customer</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <Input ref={nameRef} value={f.name} onChange={set("name")} maxLength={120} autoComplete="off" />
          </Field>
          <Field label="Mobile number">
            <Input value={f.phone} onChange={set("phone")} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" autoComplete="off" />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-4">
        <h2 className="font-semibold">2. Items</h2>
        {store.products.length > 0 && (
          <>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a product by name" className="pl-9" aria-label="Search products" autoComplete="off" />
            </div>
            <ul className="mt-3 grid max-h-72 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-line bg-surface p-2 sm:grid-cols-3">
              {shown.map((p) => {
                const inOrder = rows.filter((r) => r.name === p.name).reduce((n, r) => n + num(r.quantity), 0);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => addProduct(p)}
                      className={cn(
                        "relative flex h-full min-h-16 w-full flex-col rounded-lg border bg-white p-2.5 text-left text-sm active:scale-[0.98]",
                        inOrder ? "border-accent ring-1 ring-accent" : "border-line",
                      )}
                    >
                      <span className="line-clamp-2 pr-6 font-medium break-words">{p.name}</span>
                      <span className="mt-auto pt-1 text-ink-soft tabular-nums">{formatBDT(p.price)}</span>
                      {inOrder > 0 && (
                        <span className="absolute top-1.5 right-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-accent px-1.5 text-xs font-semibold text-white tabular-nums">{inOrder}</span>
                      )}
                    </button>
                  </li>
                );
              })}
              {!shown.length && <li className="col-span-full px-3 py-6 text-center text-sm text-ink-soft">No product matches “{search}”.</li>}
            </ul>
          </>
        )}
        {rows.length === 0 && (
          <p className="mt-3 rounded-lg border border-dashed border-line px-4 py-4 text-center text-sm text-ink-soft">
            {store.products.length ? "No items yet. Tap a product above." : "No product list on this device yet. Press Sync, or add an item by hand."}
          </p>
        )}
        <ul className="mt-3 grid gap-3">
          {rows.map((r, idx) => (
            <li key={r.key} className="grid grid-cols-2 gap-2 rounded-lg border border-line p-3 sm:grid-cols-[1fr_80px_110px_auto] sm:items-end">
              <Field label="Item" className="col-span-2 sm:col-span-1">
                <Input value={r.name} onChange={(e) => setRow(r.key, "name", e.target.value)} maxLength={200} />
              </Field>
              <Field label="Qty">
                <Input type="number" inputMode="numeric" min={1} value={r.quantity} onChange={(e) => setRow(r.key, "quantity", e.target.value)} />
              </Field>
              <Field label="Price each (৳)">
                <Input type="number" inputMode="decimal" min={0} step="any" value={r.price} onChange={(e) => setRow(r.key, "price", e.target.value)} />
              </Field>
              <Button type="button" variant="ghost" size="icon" className="order-last col-span-2 w-full text-ink-soft hover:text-danger sm:order-none sm:col-span-1 sm:w-10" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label={`Remove item ${idx + 1}`}>
                <Trash2 className="size-4" /> <span className="sm:hidden">Remove</span>
              </Button>
              <Field label="Details (name, number, color, size…)" className="col-span-2 sm:col-span-4">
                <Input
                  ref={r.key === focusKey ? (el) => el?.focus() : undefined}
                  value={r.details}
                  onChange={(e) => setRow(r.key, "details", e.target.value)}
                  onBlur={() => r.key === focusKey && setFocusKey(null)}
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
          className="mt-3"
          onClick={() => {
            setRows((rs) => [...rs, { key: nextKey, name: "", details: "", quantity: "1", price: "" }]);
            setNextKey((k) => k + 1);
          }}
        >
          <Plus className="size-4" /> Add something not in the list
        </Button>
      </section>

      <section className="rounded-xl border border-line bg-white p-4">
        <h2 className="font-semibold">3. Payment</h2>
        <div className="mt-3">
          <Checkbox label="The customer takes it now (already made, paid in full)" checked={f.tookNow} onChange={(e) => setF((v) => ({ ...v, tookNow: e.target.checked }))} />
        </div>
        {!f.tookNow && (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Paid now (৳)">
              <Input type="number" inputMode="decimal" min={0} step="any" value={f.paid} onChange={set("paid")} placeholder="0" />
            </Field>
            <Field label="Paid by">
              <Select value={f.method} onChange={set("method")}>
                {STALL_PAYMENT_METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            </Field>
            <div className="col-span-2 flex items-end sm:col-span-1">
              <Button type="button" variant="secondary" className="w-full" disabled={total <= 0} onClick={() => setF((v) => ({ ...v, paid: String(total) }))}>
                Paid in full
              </Button>
            </div>
          </div>
        )}
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-medium text-ink-soft select-none">More: discount, home delivery, note</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Discount (৳)">
              <Input type="number" inputMode="decimal" min={0} step="any" value={f.discount} onChange={set("discount")} placeholder="0" />
            </Field>
            <div className="flex items-end pb-2">
              <Checkbox label="Home delivery" checked={f.delivery} onChange={(e) => setF((v) => ({ ...v, delivery: e.target.checked }))} />
            </div>
            {f.delivery && (
              <>
                <Field label="Delivery address" className="sm:col-span-2">
                  <Textarea rows={2} value={f.address} onChange={set("address")} maxLength={300} />
                </Field>
                <Field label="Delivery charge (৳)">
                  <Input type="number" inputMode="decimal" min={0} step="any" value={f.charge} onChange={set("charge")} placeholder="0" />
                </Field>
              </>
            )}
            <Field label="Note" className="sm:col-span-2">
              <Textarea rows={2} value={f.note} onChange={set("note")} maxLength={500} />
            </Field>
          </div>
        </details>
      </section>

      {error && (
        <p role="alert" className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-line bg-white px-4 py-3">
        <p className="text-sm">
          Total <span className="text-lg font-semibold tabular-nums">{formatBDT(total)}</span>
          {due > 0 && <span className="block text-xs text-ink-soft">{formatBDT(due)} still to pay</span>}
        </p>
        <Button type="submit" variant="accent" size="lg">
          Save order
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Orders on this device, plus the open orders from the last sync
// ---------------------------------------------------------------------------
type ListOrder = { orderNumber: string; name: string; phone: string; items: string; total: number; paid: number; delivered: boolean; local: LocalOrder | null };

function OrderList({ store, update }: { store: Store; update: (fn: (s: Store) => Store) => void }) {
  const [q, setQ] = useState("");
  const [openOnly, setOpenOnly] = useState(false);

  const localNumbers = new Set(store.orders.map((o) => o.orderNumber));
  const all: ListOrder[] = [
    ...store.orders.map((o) => ({
      orderNumber: o.orderNumber,
      name: o.customerName,
      phone: o.customerPhone,
      items: o.items.map((i) => `${i.quantity} × ${i.name}${i.details ? ` (${i.details})` : ""}`).join(", "),
      total: o.total,
      paid: o.paidAmount,
      delivered: o.delivered,
      local: o,
    })),
    ...store.remote
      .filter((r) => !localNumbers.has(r.orderNumber))
      .map((r) => ({ orderNumber: r.orderNumber, name: r.customerName, phone: r.customerPhone, items: r.items, total: r.total, paid: r.paid, delivered: r.status === "delivered", local: null })),
  ];
  const term = q.trim().toLowerCase();
  const shown = all.filter((o) => (!openOnly || !o.delivered) && (!term || `${o.orderNumber} ${o.name} ${o.phone}`.toLowerCase().includes(term)));

  const today = dhakaToday();
  const todays = store.orders.filter((o) => o.eventDate === today);
  const sales = todays.reduce((n, o) => n + o.total, 0);
  const collected = todays.reduce((n, o) => n + o.paidAmount, 0);

  const setPaidAndDelivered = (s: Store, number: string, paid: number | null, delivered: boolean): Store => ({
    ...s,
    orders: s.orders.map((o) => (o.orderNumber === number ? { ...o, delivered, paidAmount: paid ?? o.paidAmount } : o)),
    remote: s.remote.map((r) => (r.orderNumber === number ? { ...r, status: delivered ? "delivered" : "ready", paid: paid ?? r.paid } : r)),
  });

  const deliver = (o: ListOrder, collect: boolean) =>
    update((s) => ({
      ...setPaidAndDelivered(s, o.orderNumber, collect ? o.total : null, true),
      deliveries: [...s.deliveries.filter((d) => d.orderNumber !== o.orderNumber), { orderNumber: o.orderNumber, collect, prevPaid: o.paid }],
    }));

  const undo = (o: ListOrder, d: Delivery) =>
    update((s) => ({ ...setPaidAndDelivered(s, o.orderNumber, d.prevPaid, false), deliveries: s.deliveries.filter((x) => x.orderNumber !== o.orderNumber) }));

  const clearUploaded = () => update((s) => ({ ...s, orders: s.orders.filter((o) => !o.synced || s.deliveries.some((d) => d.orderNumber === o.orderNumber)) }));
  const uploaded = store.orders.filter((o) => o.synced).length;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-2">
        <Tile label="Orders today" value={String(todays.length)} />
        <Tile label="Sales today" value={formatBDT(sales)} />
        <Tile label="Collected today" value={formatBDT(collected)} />
      </div>
      <p className="-mt-2 text-xs text-ink-soft">Today&apos;s numbers count the orders taken on this device only.</p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order number, phone or name" className="pl-9" aria-label="Search orders" />
        </div>
        <Checkbox label="Not delivered only" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
      </div>

      {shown.length ? (
        <ul className="grid gap-2">
          {shown.map((o) => {
            const due = round2(Math.max(0, o.total - o.paid));
            const pendingDelivery = store.deliveries.find((d) => d.orderNumber === o.orderNumber);
            return (
              <li key={o.orderNumber} className="rounded-xl border border-line bg-white p-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold">{o.orderNumber}</span>
                  {o.local && !o.local.synced && <Badge color="warning">Not uploaded</Badge>}
                  {pendingDelivery && o.local?.synced !== false && <Badge color="warning">Delivery not uploaded</Badge>}
                  <span className="ml-auto font-semibold tabular-nums">{formatBDT(o.total)}</span>
                </div>
                <p className="mt-1">
                  {o.name} · <a href={`tel:${o.phone}`} className="text-accent">{o.phone}</a>
                </p>
                <p className="mt-0.5 break-words text-ink-soft">{o.items}</p>
                {o.local?.error && <p className="mt-1 text-danger">Could not be uploaded: {o.local.error}</p>}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className={cn("tabular-nums", due > 0 ? "font-medium text-danger" : "text-success")}>{due > 0 ? `${formatBDT(due)} to pay` : "Paid"}</span>
                  {o.delivered ? (
                    <span className="flex items-center gap-1">
                      <span className="inline-flex items-center gap-1 font-medium text-success">
                        <Check className="size-4" /> Delivered
                      </span>
                      {pendingDelivery && (
                        <Button size="sm" variant="ghost" className="text-ink-soft" onClick={() => undo(o, pendingDelivery)}>
                          <Undo2 className="size-4" /> Undo
                        </Button>
                      )}
                    </span>
                  ) : (
                    <span className="flex flex-wrap items-center justify-end gap-2">
                      {due > 0 && (
                        <button type="button" className="text-xs text-ink-soft underline underline-offset-4" onClick={() => deliver(o, false)}>
                          Delivered, not paid yet
                        </button>
                      )}
                      <Button size="sm" variant="accent" onClick={() => deliver(o, true)}>
                        <Check className="size-4" /> {due > 0 ? `Delivered, got ${formatBDT(due)}` : "Delivered"}
                      </Button>
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-ink-soft">{term ? "No order matches your search." : "No orders on this device yet."}</p>
      )}

      {uploaded > 0 && (
        <button type="button" className="justify-self-center text-xs text-ink-soft underline underline-offset-4" onClick={clearUploaded}>
          Remove {uploaded} uploaded order{uploaded === 1 ? "" : "s"} from this device (they stay on the website)
        </button>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}
