"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteProduct, saveProduct, type ProductInput } from "@/app/admin/actions";
import { Button, Card, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { ImageUploader } from "./image-uploader";
import { slugify } from "@/lib/utils";

type VariantDraft = {
  key: string;
  id?: string;
  sku: string;
  options: Record<string, string>;
  price: string;
  stock: string;
  low_stock_threshold: string;
  is_active: boolean;
};

export type ProductFormValues = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  category_id: string;
  compare_at_price: string;
  is_active: boolean;
  featured: boolean;
  preorder_enabled: boolean;
  preorder_note: string;
  /** People waiting for a back-in-stock SMS. */
  waiting?: number;
  images: string[];
  optionNames: string[];
  variants: Omit<VariantDraft, "key">[];
};

const newKey = () => Math.random().toString(36).slice(2);

const blankVariant = (price = ""): VariantDraft => ({
  key: newKey(),
  sku: "",
  options: {},
  price,
  stock: "0",
  low_stock_threshold: "3",
  is_active: true,
});

export function ProductForm({
  initial,
  categories,
}: {
  initial?: ProductFormValues;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [compareAt, setCompareAt] = useState(initial?.compare_at_price ?? "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  const [preorder, setPreorder] = useState(initial?.preorder_enabled ?? false);
  const [preorderNote, setPreorderNote] = useState(initial?.preorder_note ?? "");
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [optionNames, setOptionNames] = useState<string[]>(initial?.optionNames ?? []);
  const [optionValues, setOptionValues] = useState<string[]>(initial?.optionNames.map(() => "") ?? []);
  const [variants, setVariants] = useState<VariantDraft[]>(
    initial?.variants.map((v) => ({ ...v, key: newKey() })) ?? [blankVariant()],
  );

  const updateVariant = (key: string, patch: Partial<VariantDraft>) =>
    setVariants((vs) => vs.map((v) => (v.key === key ? { ...v, ...patch } : v)));

  const addOption = () => {
    if (optionNames.length >= 3) return;
    const label = ["Color", "Size", "Material"].find((n) => !optionNames.includes(n)) ?? `Option ${optionNames.length + 1}`;
    setOptionNames([...optionNames, label]);
    setOptionValues([...optionValues, ""]);
  };

  const renameOption = (i: number, next: string) => {
    const prev = optionNames[i];
    setOptionNames(optionNames.map((n, j) => (j === i ? next : n)));
    setVariants((vs) =>
      vs.map((v) => {
        const { [prev]: val, ...rest } = v.options;
        return { ...v, options: { ...rest, [next]: val ?? "" } };
      }),
    );
  };

  const removeOption = (i: number) => {
    const prev = optionNames[i];
    setOptionNames(optionNames.filter((_, j) => j !== i));
    setOptionValues(optionValues.filter((_, j) => j !== i));
    setVariants((vs) =>
      vs.map((v) => {
        const { [prev]: _drop, ...rest } = v.options;
        void _drop;
        return { ...v, options: rest };
      }),
    );
  };

  /** Build every combination from the comma-separated option values, keeping existing rows. */
  const generate = () => {
    const lists = optionNames.map((_, i) =>
      optionValues[i].split(",").map((s) => s.trim()).filter(Boolean),
    );
    if (!optionNames.length || lists.some((l) => !l.length)) {
      return void toast.error("Enter comma-separated values for every option first");
    }
    const combos = lists.reduce<Record<string, string>[]>(
      (acc, list, i) => acc.flatMap((c) => list.map((val) => ({ ...c, [optionNames[i]]: val }))),
      [{}],
    );
    const sig = (o: Record<string, string>) => optionNames.map((n) => (o[n] ?? "").toLowerCase()).join("|");
    const existing = new Set(variants.map((v) => sig(v.options)));
    const defaultPrice = variants.find((v) => v.price)?.price ?? "";
    const added = combos.filter((c) => !existing.has(sig(c))).map((c) => ({ ...blankVariant(defaultPrice), options: c }));
    // Drop the single empty starter row if it was never filled in.
    const kept = variants.filter((v) => v.id || optionNames.some((n) => v.options[n]?.trim()));
    setVariants([...kept, ...added]);
    toast.success(`Added ${added.length} variant${added.length === 1 ? "" : "s"}`);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: ProductInput = {
      id: initial?.id,
      name,
      slug: slug || slugify(name),
      description,
      category_id: categoryId,
      compare_at_price: compareAt,
      is_active: isActive,
      featured,
      preorder_enabled: preorder,
      preorder_note: preorderNote,
      images,
      optionNames: optionNames.map((n) => n.trim()),
      variants: variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        options: v.options,
        price: v.price,
        stock: v.stock,
        low_stock_threshold: v.low_stock_threshold,
        is_active: v.is_active,
      })),
    };
    start(async () => {
      const res = await saveProduct(payload);
      if (res.error) {
        toast.error(res.error);
        if (!initial?.id && res.id) router.replace(`/admin/products/${res.id}`);
        return;
      }
      toast.success("Product saved");
      if (!initial?.id && res.id) router.replace(`/admin/products/${res.id}`);
      else router.refresh();
    });
  };

  const remove = () => {
    if (!initial?.id || !confirm(`Delete "${name}"? Products that have orders are hidden instead of deleted.`)) return;
    start(async () => {
      const res = await deleteProduct(initial.id!);
      if (res.error) return void toast.error(res.error);
      toast.success("Product removed");
      router.replace("/admin/products");
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="grid min-w-0 gap-6">
        <Card className="grid gap-4">
          <Field label="Product name">
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              required
            />
          </Field>
          <Field label="URL slug" hint={`pocketgizmo.com/product/${slug || "…"}`}>
            <Input
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
            />
          </Field>
          <Field label="Description">
            <Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </Card>

        <Card>
          <h2 className="mb-3 text-base font-semibold">Photos</h2>
          <ImageUploader images={images} onChange={setImages} />
        </Card>

        <Card className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Options & variants</h2>
            {optionNames.length < 3 && (
              <Button type="button" variant="secondary" size="sm" onClick={addOption}>
                <Plus className="size-4" /> Add option
              </Button>
            )}
          </div>

          {optionNames.length === 0 ? (
            <p className="text-sm text-ink-soft">
              No options: this product has a single variant. Add an option like Color or Size to sell variations.
            </p>
          ) : (
            <div className="grid gap-3 rounded-lg bg-surface p-3">
              {optionNames.map((n, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[160px_1fr_auto]">
                  <Input aria-label="Option name" value={n} onChange={(e) => renameOption(i, e.target.value)} />
                  <Input
                    aria-label={`${n} values`}
                    placeholder="Values, comma separated, e.g. Red, Blue, Mint"
                    value={optionValues[i]}
                    onChange={(e) => setOptionValues(optionValues.map((v, j) => (j === i ? e.target.value : v)))}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(i)} aria-label={`Remove ${n} option`}>
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="secondary" size="sm" className="justify-self-start" onClick={generate}>
                <Sparkles className="size-4" /> Generate variants
              </Button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-ink-soft">
                  {optionNames.map((n) => <th key={n} className="px-1 pb-2">{n || "Option"}</th>)}
                  <th className="px-1 pb-2">Price ৳</th>
                  <th className="px-1 pb-2">Stock</th>
                  <th className="px-1 pb-2">Low at</th>
                  <th className="px-1 pb-2">SKU</th>
                  <th className="px-1 pb-2">Live</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.key} className={v.is_active ? "" : "opacity-50"}>
                    {optionNames.map((n) => (
                      <td key={n} className="p-1">
                        <Input
                          className="h-9 min-w-24"
                          aria-label={n}
                          value={v.options[n] ?? ""}
                          onChange={(e) => updateVariant(v.key, { options: { ...v.options, [n]: e.target.value } })}
                        />
                      </td>
                    ))}
                    <td className="p-1">
                      <Input className="h-9 w-24" type="number" min={0} step="1" aria-label="Price" required value={v.price}
                        onChange={(e) => updateVariant(v.key, { price: e.target.value })} />
                    </td>
                    <td className="p-1">
                      <Input className="h-9 w-20" type="number" min={0} step="1" aria-label="Stock" required value={v.stock}
                        onChange={(e) => updateVariant(v.key, { stock: e.target.value })} />
                    </td>
                    <td className="p-1">
                      <Input className="h-9 w-16" type="number" min={0} aria-label="Low stock alert" value={v.low_stock_threshold}
                        onChange={(e) => updateVariant(v.key, { low_stock_threshold: e.target.value })} />
                    </td>
                    <td className="p-1">
                      <Input className="h-9 w-28" aria-label="SKU" value={v.sku} onChange={(e) => updateVariant(v.key, { sku: e.target.value })} />
                    </td>
                    <td className="p-1 text-center">
                      <input type="checkbox" className="size-5 accent-accent" aria-label="Variant live" checked={v.is_active}
                        onChange={(e) => updateVariant(v.key, { is_active: e.target.checked })} />
                    </td>
                    <td className="p-1">
                      <Button type="button" variant="ghost" size="icon" aria-label="Remove variant" disabled={variants.length === 1}
                        onClick={() => setVariants(variants.filter((x) => x.key !== v.key))}>
                        <Trash2 className="size-4 text-danger" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {optionNames.length > 0 && (
            <Button type="button" variant="secondary" size="sm" className="justify-self-start"
              onClick={() => setVariants([...variants, blankVariant(variants[0]?.price ?? "")])}>
              <Plus className="size-4" /> Add variant row
            </Button>
          )}
          <p className="text-xs text-ink-soft">Stock changes made here are recorded in the inventory history.</p>
        </Card>
      </div>

      <div className="grid h-fit gap-6 xl:sticky xl:top-6">
        <Card className="grid gap-4">
          <Checkbox label="Live on store" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <Checkbox label="Featured on home page" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
          <Checkbox label="Allow pre-orders when out of stock" checked={preorder} onChange={(e) => setPreorder(e.target.checked)} />
          {preorder && (
            <Field label="Pre-order note" hint="Shown to customers, e.g. Ships in 7–10 days">
              <Input value={preorderNote} onChange={(e) => setPreorderNote(e.target.value)} maxLength={120} placeholder="Ships in 7–10 days" />
            </Field>
          )}
          {!!initial?.waiting && (
            <p className="rounded-lg bg-surface px-3 py-2 text-sm text-ink-soft">
              <span className="font-medium text-ink">{initial.waiting}</span> {initial.waiting === 1 ? "person is" : "people are"} waiting for this to be back in stock. They get an SMS when you add stock.
            </p>
          )}
          <Field label="Category">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Compare-at price ৳" hint="Optional 'was' price shown crossed out">
            <Input type="number" min={0} value={compareAt} onChange={(e) => setCompareAt(e.target.value)} />
          </Field>
        </Card>
        <div className="flex gap-2">
          <Button type="submit" size="lg" className="flex-1" disabled={pending}>
            {pending ? "Saving…" : "Save product"}
          </Button>
          {initial?.id && (
            <Button type="button" variant="danger" size="lg" onClick={remove} disabled={pending} aria-label="Delete product">
              <Trash2 className="size-5" />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
