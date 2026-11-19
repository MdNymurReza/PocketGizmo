"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteDeal, saveDeal } from "@/app/admin/deals/actions";
import { Badge, Button, Card, Checkbox, Field, Input, Select } from "@/components/ui";
import { ProductPicker, type PickerProduct } from "@/components/admin/product-picker";
import { type Deal, dealRule } from "@/lib/deals";
import { useAction } from "@/lib/use-action";

type Draft = {
  id?: string;
  name: string;
  kind: "buy_x_get_y" | "n_for_price";
  buy_qty: string;
  get_qty: string;
  bundle_qty: string;
  bundle_price: string;
  scope: "all" | "category" | "products";
  category_id: string;
  product_ids: string[];
  starts_at: string;
  ends_at: string;
  active: boolean;
};

const empty: Draft = {
  name: "", kind: "buy_x_get_y", buy_qty: "2", get_qty: "1", bundle_qty: "3", bundle_price: "", scope: "all", category_id: "", product_ids: [], starts_at: "", ends_at: "", active: true,
};

const toYmd = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }) : "");

function dealState(d: Deal) {
  const now = Date.now();
  if (!d.active) return { label: "Off", color: "neutral" as const };
  if (d.ends_at && Date.parse(d.ends_at) < now) return { label: "Ended", color: "neutral" as const };
  if (d.starts_at && Date.parse(d.starts_at) > now) return { label: "Scheduled", color: "info" as const };
  return { label: "Live", color: "success" as const };
}

export function DealManager({ deals, categories, products }: { deals: Deal[]; categories: { id: string; name: string }[]; products: PickerProduct[] }) {
  const [draft, setDraft] = useState<Draft>(empty);
  const { pending, run } = useAction();
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  const edit = (d: Deal) =>
    setDraft({
      id: d.id,
      name: d.name,
      kind: d.kind,
      buy_qty: String(d.buy_qty ?? 2),
      get_qty: String(d.get_qty ?? 1),
      bundle_qty: String(d.bundle_qty ?? 3),
      bundle_price: d.bundle_price?.toString() ?? "",
      scope: d.product_ids.length ? "products" : d.category_id ? "category" : "all",
      category_id: d.category_id ?? "",
      product_ids: d.product_ids,
      starts_at: toYmd(d.starts_at),
      ends_at: toYmd(d.ends_at),
      active: d.active,
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => saveDeal(draft), draft.id ? "Deal updated" : "Deal created", () => setDraft(empty));
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
      <div className="grid h-fit gap-4">
        <p className="text-sm text-ink-soft">
          Deals apply on their own in the cart. When several fit, the customer gets the one that saves the most. A coupon can still be used on top.
        </p>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs text-ink-soft">
              <tr>
                <th className="px-4 py-3 font-medium">Deal</th>
                <th className="px-4 py-3 font-medium">Applies to</th>
                <th className="px-4 py-3 font-medium">Dates</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {deals.map((d) => {
                const st = dealState(d);
                return (
                  <tr key={d.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{d.name}</p>
                      <p className="text-xs text-ink-soft">{dealRule(d)}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {d.product_ids.length ? `${d.product_ids.length} product${d.product_ids.length === 1 ? "" : "s"}` : d.category_id ? catName.get(d.category_id) ?? "A category" : "Everything"}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-soft">{d.starts_at || d.ends_at ? `${toYmd(d.starts_at) || "now"} → ${toYmd(d.ends_at) || "no end"}` : "Always"}</td>
                    <td className="px-4 py-3"><Badge color={st.color}>{st.label}</Badge></td>
                    <td className="px-2 py-3 text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" className="size-8" aria-label={`Edit ${d.name}`} onClick={() => edit(d)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Delete ${d.name}`}
                        disabled={pending}
                        onClick={() => confirm(`Delete the deal "${d.name}"? Past orders keep their discount.`) && run(() => deleteDeal(d.id), "Deal deleted")}
                      >
                        <Trash2 className="size-4 text-danger" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!deals.length && <p className="p-6 text-ink-soft">No deals yet. Try &ldquo;Buy 2, get 1 free&rdquo; on keychains.</p>}
        </Card>
      </div>

      <Card className="h-fit">
        <h2 className="mb-4 font-semibold">{draft.id ? `Edit ${draft.name}` : "New deal"}</h2>
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Name" hint="Customers see this in the cart">
            <Input value={draft.name} onChange={set("name")} placeholder="Keychain Buy 2 Get 1" required />
          </Field>
          <Field label="Type">
            <Select value={draft.kind} onChange={set("kind")}>
              <option value="buy_x_get_y">Buy X, get Y free</option>
              <option value="n_for_price">Bundle: any N for a set price</option>
            </Select>
          </Field>
          {draft.kind === "buy_x_get_y" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Buy">
                <Input type="number" min={1} value={draft.buy_qty} onChange={set("buy_qty")} required />
              </Field>
              <Field label="Get free" hint="The cheapest ones are free">
                <Input type="number" min={1} value={draft.get_qty} onChange={set("get_qty")} required />
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Any">
                <Input type="number" min={2} value={draft.bundle_qty} onChange={set("bundle_qty")} required />
              </Field>
              <Field label="For (৳)">
                <Input type="number" min={1} value={draft.bundle_price} onChange={set("bundle_price")} required />
              </Field>
            </div>
          )}
          <Field label="Applies to">
            <Select value={draft.scope} onChange={set("scope")}>
              <option value="all">Every product</option>
              <option value="category">One category</option>
              <option value="products">Products I pick</option>
            </Select>
          </Field>
          {draft.scope === "category" && (
            <Field label="Category">
              <Select value={draft.category_id} onChange={set("category_id")} required>
                <option value="">Pick a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
          )}
          {draft.scope === "products" && (
            <ProductPicker products={products} value={draft.product_ids} onChange={(ids) => setDraft((d) => ({ ...d, product_ids: ids }))} />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts">
              <Input type="date" value={draft.starts_at} onChange={set("starts_at")} />
            </Field>
            <Field label="Ends">
              <Input type="date" value={draft.ends_at} onChange={set("ends_at")} />
            </Field>
          </div>
          <Checkbox label="Active" checked={draft.active} onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))} />
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {draft.id ? "Save changes" : (<><Plus className="size-4" /> Create deal</>)}
            </Button>
            {draft.id && <Button type="button" variant="secondary" onClick={() => setDraft(empty)}>Cancel</Button>}
          </div>
        </form>
      </Card>
    </div>
  );
}
