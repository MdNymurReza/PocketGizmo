"use client";

import { useRef, useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { deleteStallProduct, importShopProducts, saveStallProduct } from "@/app/admin/stall/products/actions";
import { Button, Card, EmptyState, Field, Input } from "@/components/ui";
import { ProductImage } from "@/components/shop/product-image";
import { useAction } from "@/lib/use-action";
import { formatBDT } from "@/lib/utils";

export type StallProduct = { id: string; name: string; price: number; image: string | null };

/** The stall's product list: quick add at the top, then one row per product to edit or delete. */
export function StallProductManager({ products }: { products: StallProduct[] }) {
  const { pending, run } = useAction();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    run(
      () => saveStallProduct({ name, price: price.trim() === "" ? NaN : Number(price) }),
      `${name.trim()} added`,
      () => {
        setName("");
        setPrice("");
        nameRef.current?.focus();
      },
    );
  };

  return (
    <div className="grid max-w-3xl gap-6">
      <Card>
        <h2 className="font-semibold">Add a product</h2>
        <form onSubmit={add} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
          <Field label="Name" className="col-span-2 sm:col-span-1">
            <Input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} placeholder="e.g. Name keychain" autoComplete="off" />
          </Field>
          <Field label="Price (৳)">
            <Input type="number" inputMode="decimal" min={0} step="any" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </Field>
          <Button type="submit" disabled={pending}>
            <Plus className="size-4" /> Add
          </Button>
        </form>
        <p className="mt-3 text-xs text-ink-soft">After you click Add, the cursor goes back to Name, so you can type the next product right away.</p>
        <div className="mt-4 border-t border-line pt-4">
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => run(importShopProducts, (r) => (r.count ? `${r.count} product${r.count === 1 ? "" : "s"} copied from the website` : "All website products are already in the list"))}
          >
            <Download className="size-4" /> Copy the products from the website
          </Button>
        </div>
      </Card>

      <Card className="p-0">
        <h2 className="border-b border-line px-5 py-3 font-semibold">
          Product list <span className="font-normal text-ink-soft">({products.length})</span>
        </h2>
        {products.length ? (
          <ul className="divide-y divide-line">
            {products.map((p) => (
              <ProductRow key={`${p.id}:${p.name}:${p.price}`} product={p} />
            ))}
          </ul>
        ) : (
          <EmptyState title="No products yet" text="Add the products you will sell at the stall. They show up as a grid when you take an order." />
        )}
      </Card>
    </div>
  );
}

function ProductRow({ product: p }: { product: StallProduct }) {
  const { pending, run } = useAction();
  const [name, setName] = useState(p.name);
  const [price, setPrice] = useState(String(p.price));
  const [confirming, setConfirming] = useState(false);
  const dirty = name.trim() !== p.name || Number(price) !== p.price;

  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3">
      <ProductImage src={p.image} alt="" sizes="40px" className="size-10 shrink-0 rounded-md" />
      <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} className="h-9 min-w-40 flex-1" aria-label={`Name of ${p.name}`} />
      <Input type="number" inputMode="decimal" min={0} step="any" value={price} onChange={(e) => setPrice(e.target.value)} className="h-9 w-28" aria-label={`Price of ${p.name}`} />
      {confirming ? (
        <>
          <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => deleteStallProduct(p.id), `${p.name} deleted`)}>
            Delete
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
            Keep
          </Button>
        </>
      ) : (
        <>
          <Button size="sm" disabled={pending || !dirty} onClick={() => run(() => saveStallProduct({ id: p.id, name, price: price.trim() === "" ? NaN : Number(price) }), `Saved, now ${formatBDT(Number(price))}`)}>
            Save
          </Button>
          <Button size="sm" variant="ghost" className="text-ink-soft hover:text-danger" onClick={() => setConfirming(true)} aria-label={`Delete ${p.name}`}>
            <Trash2 className="size-4" />
          </Button>
        </>
      )}
    </li>
  );
}
