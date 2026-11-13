"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { addJob, setJobsPaid, setSupplier } from "@/app/admin/supplier/actions";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { formatBDT } from "@/lib/utils";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error?: string }>, ok: string, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.error) return void toast.error(res.error);
      toast.success(ok);
      after?.();
      router.refresh();
    });
  return { pending, run };
}

/** Pays every printed job that has a cost, after a confirmation. */
export function PayAllButton({ ids, total }: { ids: string[]; total: number }) {
  const { pending, run } = useRun();
  const [confirming, setConfirming] = useState(false);
  if (!ids.length) return null;
  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-soft">
          Mark {ids.length} job{ids.length === 1 ? "" : "s"} ({formatBDT(total)}) as paid?
        </span>
        <Button size="sm" disabled={pending} onClick={() => run(() => setJobsPaid(ids, true), "Marked as paid", () => setConfirming(false))}>
          Yes, paid
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    );
  }
  return (
    <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>
      Mark all printed as paid · {formatBDT(total)}
    </Button>
  );
}

export type JobProduct = { id: string; name: string; variants: { id: string; label: string }[] };

const EMPTY_JOB = { title: "", variant: "", details: "", quantity: "1", unitCost: "" };

/**
 * Add a job that does not come from a store order: pick a product from the shop (e.g. to print stock),
 * or type a name for anything else (e.g. a custom request).
 */
export function AddJobForm({ products, initialProductId }: { products: JobProduct[]; initialProductId?: string }) {
  const { pending, run } = useRun();
  const preset = products.find((p) => p.id === initialProductId);
  const [open, setOpen] = useState(Boolean(preset));
  const [productId, setProductId] = useState(preset?.id ?? "");
  const [variantId, setVariantId] = useState(preset?.variants[0]?.id ?? "");
  const [f, setF] = useState(EMPTY_JOB);
  const set = (k: keyof typeof EMPTY_JOB) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((v) => ({ ...v, [k]: e.target.value }));
  const product = products.find((p) => p.id === productId);

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Add a job
      </Button>
    );
  }

  const pickProduct = (id: string) => {
    setProductId(id);
    setVariantId(products.find((p) => p.id === id)?.variants[0]?.id ?? "");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(
      () =>
        addJob({
          variantId: product ? variantId : undefined,
          title: product ? product.name : f.title,
          variant: product ? undefined : f.variant,
          details: f.details,
          quantity: Number(f.quantity),
          unitCost: f.unitCost.trim() === "" ? undefined : Number(f.unitCost),
        }),
      "Job added to the print list",
      () => {
        setF(EMPTY_JOB);
        setOpen(false);
      },
    );
  };

  return (
    <Card className="w-full max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold">Add a job</h2>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-ink-soft hover:bg-surface hover:text-ink" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Product" hint="Pick one from your shop, or choose “Something else” and type a name." className={product ? "" : "sm:col-span-2"}>
          <Select value={productId} onChange={(e) => pickProduct(e.target.value)}>
            <option value="">Something else (type a name)</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        {product ? (
          <Field label="Option">
            <Select value={variantId} onChange={(e) => setVariantId(e.target.value)} required>
              {product.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label || "Standard"}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <>
            <Field label="What to print">
              <Input value={f.title} onChange={set("title")} required maxLength={200} placeholder="e.g. Custom keychain for a request" />
            </Field>
            <Field label="Color / size (optional)">
              <Input value={f.variant} onChange={set("variant")} maxLength={200} placeholder="e.g. Red / Large" />
            </Field>
          </>
        )}
        <Field label="Quantity">
          <Input type="number" min={1} max={9999} value={f.quantity} onChange={set("quantity")} required />
        </Field>
        <Field label="Cost per piece (৳)" hint="Optional. The supplier can fill this in.">
          <Input type="number" min={0} step="any" value={f.unitCost} onChange={set("unitCost")} />
        </Field>
        <Field label="Details (optional)" className="sm:col-span-2">
          <Textarea rows={2} value={f.details} onChange={set("details")} maxLength={500} placeholder="e.g. name and number, file to use" />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending || (Boolean(product) && !variantId)}>
            Add to print list
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Choose which account can open the supplier dashboard. */
export function SupplierAccess({ suppliers }: { suppliers: { id: string; email: string; full_name: string | null }[] }) {
  const { pending, run } = useRun();
  const [email, setEmail] = useState("");
  return (
    <Card className="mt-8 max-w-3xl">
      <h2 className="font-semibold">Supplier account</h2>
      <p className="mt-1 text-sm text-ink-soft">
        The supplier signs up on the store like a customer. Enter their email here to give them the print jobs dashboard at /supplier. They see the jobs
        only: no customer names, phone numbers or addresses.
      </p>
      {suppliers.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-lg border border-line text-sm">
          {suppliers.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0 break-all">
                {s.full_name && <span className="font-medium">{s.full_name} · </span>}
                {s.email}
              </span>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setSupplier(s.email, false), "Supplier access removed")}>
                Remove access
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => setSupplier(email, true), "Supplier access given", () => setEmail(""));
        }}
      >
        <Field label="Supplier's email" className="min-w-56 flex-1">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="friend@example.com" />
        </Field>
        <Button type="submit" disabled={pending}>
          Give access
        </Button>
      </form>
    </Card>
  );
}
