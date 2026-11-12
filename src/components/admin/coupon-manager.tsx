"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCoupon, saveCoupon } from "@/app/admin/coupons/actions";
import { Badge, Button, Card, Checkbox, Field, Input, Select } from "@/components/ui";
import type { Tables } from "@/lib/database.types";
import { formatBDT } from "@/lib/utils";

type Coupon = Tables<"coupons">;

type Draft = {
  id?: string;
  code: string;
  type: "percent" | "fixed";
  value: string;
  min_order: string;
  max_discount: string;
  usage_limit: string;
  per_user_limit: string;
  starts_at: string;
  ends_at: string;
  active: boolean;
};

const empty: Draft = {
  code: "", type: "percent", value: "", min_order: "0", max_discount: "", usage_limit: "", per_user_limit: "", starts_at: "", ends_at: "", active: true,
};

const toYmd = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }) : "");

function couponState(c: Coupon) {
  const now = Date.now();
  if (!c.active) return { label: "Off", color: "neutral" as const };
  if (c.ends_at && new Date(c.ends_at).getTime() < now) return { label: "Expired", color: "neutral" as const };
  if (c.starts_at && new Date(c.starts_at).getTime() > now) return { label: "Scheduled", color: "info" as const };
  if (c.usage_limit != null && c.used_count >= c.usage_limit) return { label: "Used up", color: "neutral" as const };
  return { label: "Active", color: "success" as const };
}

export function CouponManager({ coupons }: { coupons: Coupon[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(empty);
  const [pending, start] = useTransition();
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  const edit = (c: Coupon) =>
    setDraft({
      id: c.id,
      code: c.code,
      type: c.type,
      value: String(c.value),
      min_order: String(c.min_order),
      max_discount: c.max_discount?.toString() ?? "",
      usage_limit: c.usage_limit?.toString() ?? "",
      per_user_limit: c.per_user_limit?.toString() ?? "",
      starts_at: toYmd(c.starts_at),
      ends_at: toYmd(c.ends_at),
      active: c.active,
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await saveCoupon(draft);
      if (res.error) return void toast.error(res.error);
      toast.success(draft.id ? "Coupon updated" : "Coupon created");
      setDraft(empty);
      router.refresh();
    });
  };

  const remove = (c: Coupon) => {
    if (!confirm(c.used_count ? `"${c.code}" has been used, so it will be switched off instead of deleted.` : `Delete coupon "${c.code}"?`)) return;
    start(async () => {
      const res = await deleteCoupon(c.id);
      if (res.error) return void toast.error(res.error);
      toast.success(c.used_count ? "Coupon switched off" : "Coupon deleted");
      router.refresh();
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="border-b border-line bg-surface text-xs text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Discount</th>
              <th className="px-4 py-3 font-medium">Conditions</th>
              <th className="px-4 py-3 font-medium">Used</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {coupons.map((c) => {
              const st = couponState(c);
              return (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-mono font-medium">{c.code}</td>
                  <td className="px-4 py-3">
                    {c.type === "percent" ? `${Number(c.value)}%` : formatBDT(c.value)}
                    {c.max_discount != null && <span className="block text-xs text-ink-soft">max {formatBDT(c.max_discount)}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-soft">
                    {Number(c.min_order) > 0 && <span className="block">Min {formatBDT(c.min_order)}</span>}
                    {c.per_user_limit != null && <span className="block">{c.per_user_limit}× per customer</span>}
                    {(c.starts_at || c.ends_at) && (
                      <span className="block">
                        {toYmd(c.starts_at) || "now"} → {toYmd(c.ends_at) || "no end"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {c.used_count}
                    {c.usage_limit != null && <span className="text-ink-soft"> / {c.usage_limit}</span>}
                  </td>
                  <td className="px-4 py-3"><Badge color={st.color}>{st.label}</Badge></td>
                  <td className="px-2 py-3 text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon" className="size-8" aria-label={`Edit ${c.code}`} onClick={() => edit(c)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8" aria-label={`Delete ${c.code}`} onClick={() => remove(c)} disabled={pending}>
                      <Trash2 className="size-4 text-danger" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!coupons.length && <p className="p-6 text-ink-soft">No coupons yet.</p>}
      </Card>

      <Card className="h-fit">
        <h2 className="mb-4 font-semibold">{draft.id ? `Edit ${draft.code}` : "New coupon"}</h2>
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Code">
            <Input value={draft.code} onChange={set("code")} className="font-mono uppercase" placeholder="EID20" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={draft.type} onChange={set("type")}>
                <option value="percent">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </Select>
            </Field>
            <Field label={draft.type === "percent" ? "Percent off" : "Amount off (৳)"}>
              <Input type="number" min={0} step="any" value={draft.value} onChange={set("value")} required />
            </Field>
            <Field label="Min order (৳)">
              <Input type="number" min={0} value={draft.min_order} onChange={set("min_order")} />
            </Field>
            <Field label="Max discount (৳)" hint={draft.type === "percent" ? "Optional cap" : undefined}>
              <Input type="number" min={0} value={draft.max_discount} onChange={set("max_discount")} disabled={draft.type === "fixed"} />
            </Field>
            <Field label="Total uses" hint="Blank = unlimited">
              <Input type="number" min={1} value={draft.usage_limit} onChange={set("usage_limit")} />
            </Field>
            <Field label="Per customer" hint="Signed-in customers">
              <Input type="number" min={1} value={draft.per_user_limit} onChange={set("per_user_limit")} />
            </Field>
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
              {draft.id ? "Save changes" : (<><Plus className="size-4" /> Create coupon</>)}
            </Button>
            {draft.id && (
              <Button type="button" variant="secondary" onClick={() => setDraft(empty)}>Cancel</Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
