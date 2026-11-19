"use client";

import { useState } from "react";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteCollection, saveCollection } from "@/app/admin/collections/actions";
import { Badge, Button, Card, Checkbox, Field, Input, Textarea } from "@/components/ui";
import { ImageUploader } from "@/components/admin/image-uploader";
import { ProductPicker, type PickerProduct } from "@/components/admin/product-picker";
import type { Tables } from "@/lib/database.types";
import { useAction } from "@/lib/use-action";

type Collection = Tables<"collections"> & { product_ids: string[] };

type Draft = {
  id?: string;
  title: string;
  slug: string;
  subtitle: string;
  banner_image: string;
  coupon_code: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  sort_order: string;
  product_ids: string[];
};

const empty: Draft = { title: "", slug: "", subtitle: "", banner_image: "", coupon_code: "", starts_at: "", ends_at: "", is_active: true, sort_order: "0", product_ids: [] };
const toYmd = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }) : "");

function state(c: Collection) {
  const now = Date.now();
  if (!c.is_active) return { label: "Hidden", color: "neutral" as const };
  if (c.ends_at && Date.parse(c.ends_at) < now) return { label: "Ended", color: "neutral" as const };
  if (c.starts_at && Date.parse(c.starts_at) > now) return { label: "Scheduled", color: "info" as const };
  return { label: "Live", color: "success" as const };
}

export function CollectionManager({ collections, products }: { collections: Collection[]; products: PickerProduct[] }) {
  const [draft, setDraft] = useState<Draft>(empty);
  const { pending, run } = useAction();
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  const edit = (c: Collection) =>
    setDraft({
      id: c.id,
      title: c.title,
      slug: c.slug,
      subtitle: c.subtitle ?? "",
      banner_image: c.banner_image ?? "",
      coupon_code: c.coupon_code ?? "",
      starts_at: toYmd(c.starts_at),
      ends_at: toYmd(c.ends_at),
      is_active: c.is_active,
      sort_order: String(c.sort_order),
      product_ids: c.product_ids,
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => saveCollection(draft), draft.id ? "Collection updated" : "Collection created", () => setDraft(empty));
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <div className="grid h-fit gap-4">
        <p className="text-sm text-ink-soft">
          Pages for occasions like Eid, Pohela Boishakh, Valentine&rsquo;s or back to school. Live ones show on the home page with a countdown to the end date.
        </p>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs text-ink-soft">
              <tr>
                <th className="px-4 py-3 font-medium">Collection</th>
                <th className="px-4 py-3 font-medium">Products</th>
                <th className="px-4 py-3 font-medium">Dates</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {collections.map((c) => {
                const st = state(c);
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-3">
                      <a href={`/collections/${c.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium hover:text-accent">
                        {c.title} <ExternalLink className="size-3.5" />
                      </a>
                      {c.coupon_code && <p className="font-mono text-xs text-ink-soft">{c.coupon_code}</p>}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{c.product_ids.length}</td>
                    <td className="px-4 py-3 text-xs text-ink-soft">{c.starts_at || c.ends_at ? `${toYmd(c.starts_at) || "now"} → ${toYmd(c.ends_at) || "no end"}` : "Always"}</td>
                    <td className="px-4 py-3"><Badge color={st.color}>{st.label}</Badge></td>
                    <td className="px-2 py-3 text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" className="size-8" aria-label={`Edit ${c.title}`} onClick={() => edit(c)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Delete ${c.title}`}
                        disabled={pending}
                        onClick={() => confirm(`Delete the collection "${c.title}"? The products stay in the shop.`) && run(() => deleteCollection(c.id), "Collection deleted")}
                      >
                        <Trash2 className="size-4 text-danger" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!collections.length && <p className="p-6 text-ink-soft">No collections yet.</p>}
        </Card>
      </div>

      <Card className="h-fit">
        <h2 className="mb-4 font-semibold">{draft.id ? `Edit ${draft.title}` : "New collection"}</h2>
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Title">
            <Input value={draft.title} onChange={set("title")} placeholder="Eid gifts" required />
          </Field>
          <Field label="Link name" hint={`/collections/${draft.slug || "eid-gifts"} · blank = from the title`}>
            <Input value={draft.slug} onChange={set("slug")} placeholder="eid-gifts" />
          </Field>
          <Field label="Subtitle">
            <Textarea rows={2} value={draft.subtitle} onChange={set("subtitle")} placeholder="Little gifts that arrive before Chand Raat" />
          </Field>
          <Field label="Banner image" hint="Optional. Wide images look best.">
            <ImageUploader
              images={draft.banner_image ? [draft.banner_image] : []}
              onChange={(imgs) => setDraft((d) => ({ ...d, banner_image: imgs.at(-1) ?? "" }))}
            />
          </Field>
          <Field label="Coupon to show" hint="Optional. An existing coupon code, shown on the page.">
            <Input value={draft.coupon_code} onChange={set("coupon_code")} className="font-mono uppercase" placeholder="EID20" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts">
              <Input type="date" value={draft.starts_at} onChange={set("starts_at")} />
            </Field>
            <Field label="Ends" hint="Shows a countdown">
              <Input type="date" value={draft.ends_at} onChange={set("ends_at")} />
            </Field>
          </div>
          <Field label="Products">
            <ProductPicker products={products} value={draft.product_ids} onChange={(ids) => setDraft((d) => ({ ...d, product_ids: ids }))} />
          </Field>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Checkbox label="Show in the shop" checked={draft.is_active} onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))} />
            <Field label="Order" className="w-24">
              <Input type="number" min={0} value={draft.sort_order} onChange={set("sort_order")} />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {draft.id ? "Save changes" : (<><Plus className="size-4" /> Create collection</>)}
            </Button>
            {draft.id && <Button type="button" variant="secondary" onClick={() => setDraft(empty)}>Cancel</Button>}
          </div>
        </form>
      </Card>
    </div>
  );
}
