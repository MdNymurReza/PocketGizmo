"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { toast } from "sonner";
import { saveSettings } from "@/app/admin/settings/actions";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";

type Values = {
  store_name: string;
  shipping_inside_dhaka: string;
  shipping_outside_dhaka: string;
  free_shipping_over: string;
  bkash_number: string;
  nagad_number: string;
  rocket_number: string;
  payment_instructions: string;
  contact_phone: string;
  contact_email: string;
  facebook_url: string;
  cod_advance: "off" | "outside_dhaka" | "all";
};

const COD_ADVANCE_OPTIONS = [
  { value: "off", label: "Off", hint: "Customers pay everything on delivery." },
  { value: "outside_dhaka", label: "Outside Dhaka only", hint: "Ask for the delivery charge in advance when shipping outside Dhaka." },
  { value: "all", label: "All COD orders", hint: "Always ask for the delivery charge in advance." },
] as const;

const PLACEHOLDER = /X{4,}/i;

export function SettingsForm({ initial }: { initial: Values }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  const placeholders = [v.bkash_number, v.nagad_number, v.rocket_number].some((n) => PLACEHOLDER.test(n));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await saveSettings(v);
      if (res.error) return void toast.error(res.error);
      toast.success("Settings saved");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="grid max-w-3xl gap-6">
      <Card>
        <h2 className="font-semibold">Payment numbers</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Customers send money to these numbers at checkout. Leave a field empty to hide that method.
        </p>
        {placeholders && (
          <p className="mt-4 flex gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            Placeholder numbers are still set. Replace them with your real numbers (or clear them) before going live.
          </p>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="bKash">
            <Input value={v.bkash_number} onChange={set("bkash_number")} placeholder="01XXXXXXXXX" className="font-mono" />
          </Field>
          <Field label="Nagad">
            <Input value={v.nagad_number} onChange={set("nagad_number")} placeholder="01XXXXXXXXX" className="font-mono" />
          </Field>
          <Field label="Rocket">
            <Input value={v.rocket_number} onChange={set("rocket_number")} placeholder="01XXXXXXXXX-X" className="font-mono" />
          </Field>
          <Field label="Instructions shown at checkout" className="sm:col-span-3">
            <Textarea rows={2} value={v.payment_instructions} onChange={set("payment_instructions")} />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold">Delivery charges</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Inside Dhaka (৳)">
            <Input type="number" min={0} value={v.shipping_inside_dhaka} onChange={set("shipping_inside_dhaka")} required />
          </Field>
          <Field label="Outside Dhaka (৳)">
            <Input type="number" min={0} value={v.shipping_outside_dhaka} onChange={set("shipping_outside_dhaka")} required />
          </Field>
          <Field label="Free delivery over (৳)" hint="Blank = never free">
            <Input type="number" min={0} value={v.free_shipping_over} onChange={set("free_shipping_over")} />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold">Cash on delivery protection</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Ask COD customers to pay the delivery charge in advance by bKash, Nagad or Rocket. This cuts down fake orders and
          refused parcels. The rest is still paid in cash on delivery.
        </p>
        <fieldset className="mt-4 grid gap-2 sm:grid-cols-3">
          <legend className="sr-only">Advance delivery charge</legend>
          {COD_ADVANCE_OPTIONS.map((o) => (
            <label
              key={o.value}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors ${
                v.cod_advance === o.value ? "border-ink ring-1 ring-ink" : "border-line hover:border-ink/30"
              }`}
            >
              <input
                type="radio"
                name="cod_advance"
                checked={v.cod_advance === o.value}
                onChange={() => setV((x) => ({ ...x, cod_advance: o.value }))}
                className="mt-0.5 size-4 shrink-0 accent-ink"
              />
              <span>
                <span className="font-medium">{o.label}</span>
                <span className="mt-0.5 block text-ink-soft">{o.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <p className="mt-3 text-xs text-ink-soft">
          Needs at least one real payment number above. Orders with free delivery never need an advance.
        </p>
      </Card>

      <Card>
        <h2 className="font-semibold">Store details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Store name">
            <Input value={v.store_name} onChange={set("store_name")} required />
          </Field>
          <Field label="Contact phone">
            <Input value={v.contact_phone} onChange={set("contact_phone")} type="tel" />
          </Field>
          <Field label="Contact email">
            <Input value={v.contact_email} onChange={set("contact_email")} type="email" />
          </Field>
          <Field label="Facebook page URL">
            <Input value={v.facebook_url} onChange={set("facebook_url")} placeholder="https://facebook.com/…" />
          </Field>
        </div>
      </Card>

      <div>
        <Button type="submit" size="lg" disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button>
      </div>
    </form>
  );
}
