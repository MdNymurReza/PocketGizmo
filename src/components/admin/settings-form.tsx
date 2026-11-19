"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveSettings, sendTestSms } from "@/app/admin/settings/actions";
import { Button, Card, Checkbox, Field, Input, Textarea } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";

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
  whatsapp_number: string;
  messenger_url: string;
  gift_enabled: boolean;
  gift_wrap_fee: string;
  sms_enabled: boolean;
  sms_events: string[];
  points_enabled: boolean;
  points_spend_per_point: string;
  points_review: string;
  points_max_pct: string;
};

type Status = {
  smsReady: boolean;
  steadfastReady: boolean;
  smsEvents: readonly { key: string; label: string }[];
  smsLog: { id: string; phone: string; event: string; ok: boolean; error: string | null; created_at: string }[];
};

const COD_ADVANCE_OPTIONS = [
  { value: "off", label: "Off", hint: "Customers pay everything on delivery." },
  { value: "outside_dhaka", label: "Outside Dhaka only", hint: "Ask for the delivery charge in advance when shipping outside Dhaka." },
  { value: "all", label: "All COD orders", hint: "Always ask for the delivery charge in advance." },
] as const;

const PLACEHOLDER = /X{4,}/i;

export function SettingsForm({ initial, status }: { initial: Values; status: Status }) {
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
          <Field label="Instructions shown at checkout" hint="Shown under the payment steps for bKash, Nagad and Rocket. Line breaks are kept." className="sm:col-span-3">
            <Textarea rows={7} value={v.payment_instructions} onChange={set("payment_instructions")} />
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

      <Card>
        <h2 className="font-semibold">Chat button</h2>
        <p className="mt-1 text-sm text-ink-soft">
          The round button on every shop page. Leave these blank to use the contact phone and the Facebook page above.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="WhatsApp number">
            <Input value={v.whatsapp_number} onChange={set("whatsapp_number")} type="tel" placeholder={v.contact_phone || "01XXXXXXXXX"} />
          </Field>
          <Field label="Messenger link" hint="e.g. https://m.me/yourpage">
            <Input value={v.messenger_url} onChange={set("messenger_url")} placeholder="https://m.me/…" />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold">Gift wrap</h2>
        <div className="mt-4 grid items-end gap-4 sm:grid-cols-2">
          <Checkbox label="Offer gift wrap at checkout" checked={v.gift_enabled} onChange={(e) => setV((x) => ({ ...x, gift_enabled: e.target.checked }))} />
          <Field label="Gift wrap charge (৳)" hint="0 = free">
            <Input type="number" min={0} value={v.gift_wrap_fee} onChange={set("gift_wrap_fee")} disabled={!v.gift_enabled} />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold">Loyalty points</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Logged-in customers earn points when an order is delivered and when a review is approved. 1 point = ৳1 off a later order.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Checkbox label="Loyalty points are on" checked={v.points_enabled} onChange={(e) => setV((x) => ({ ...x, points_enabled: e.target.checked }))} />
          <Field label="1 point for every (৳ spent)">
            <Input type="number" min={1} value={v.points_spend_per_point} onChange={set("points_spend_per_point")} disabled={!v.points_enabled} />
          </Field>
          <Field label="Points for an approved review">
            <Input type="number" min={0} value={v.points_review} onChange={set("points_review")} disabled={!v.points_enabled} />
          </Field>
          <Field label="Points can pay up to (% of the order)">
            <Input type="number" min={0} max={100} value={v.points_max_pct} onChange={set("points_max_pct")} disabled={!v.points_enabled} />
          </Field>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">SMS to customers</h2>
          <Ready ok={status.smsReady} on="BulkSMSBD connected" off="BulkSMSBD keys missing" />
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          Sent through BulkSMSBD. Needs BULKSMSBD_API_KEY and BULKSMSBD_SENDER_ID in the server environment.
        </p>
        <div className="mt-4 grid gap-3">
          <Checkbox label="Send SMS updates" checked={v.sms_enabled} onChange={(e) => setV((x) => ({ ...x, sms_enabled: e.target.checked }))} />
          <fieldset className="grid gap-2 sm:grid-cols-3" disabled={!v.sms_enabled}>
            <legend className="mb-2 text-sm text-ink-soft">Text the customer when:</legend>
            {status.smsEvents.map((ev) => (
              <label key={ev.key} className={cn("inline-flex items-center gap-2 text-sm", !v.sms_enabled && "opacity-50")}>
                <input
                  type="checkbox"
                  className="size-4 accent-accent"
                  checked={v.sms_events.includes(ev.key)}
                  onChange={(e) =>
                    setV((x) => ({ ...x, sms_events: e.target.checked ? [...x.sms_events, ev.key] : x.sms_events.filter((k) => k !== ev.key) }))
                  }
                />
                {ev.label}
              </label>
            ))}
          </fieldset>
          <TestSms disabled={!status.smsReady} />
          {status.smsLog.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium">Recent messages</p>
              <ul className="mt-2 divide-y divide-line rounded-lg border border-line text-sm">
                {status.smsLog.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span>
                      <span className="font-mono">{m.phone}</span> <span className="text-ink-soft">· {m.event.replace(/_/g, " ")}</span>
                    </span>
                    <span className={cn("text-xs", m.ok ? "text-success" : "text-danger")}>
                      {m.ok ? "Sent" : m.error ?? "Failed"} · {formatDate(m.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Steadfast courier</h2>
          <Ready ok={status.steadfastReady} on="Connected" off="Keys missing" />
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          Book a parcel from any order page in one click. Add STEADFAST_API_KEY and STEADFAST_SECRET_KEY (Steadfast merchant panel → API) to the server environment.
        </p>
      </Card>

      <div>
        <Button type="submit" size="lg" disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button>
      </div>
    </form>
  );
}

function Ready({ ok, on, off }: { ok: boolean; on: string; off: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", ok ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>
      {ok ? <CheckCircle2 className="size-3.5" /> : <CircleAlert className="size-3.5" />} {ok ? on : off}
    </span>
  );
}

function TestSms({ disabled }: { disabled: boolean }) {
  const [phone, setPhone] = useState("");
  const [pending, start] = useTransition();
  const send = () =>
    start(async () => {
      const res = await sendTestSms(phone);
      if (res.error) return void toast.error(res.error);
      toast.success("Test SMS sent");
    });
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Send a test SMS to" className="min-w-0 flex-1">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="01XXXXXXXXX" disabled={disabled} />
      </Field>
      <Button type="button" variant="secondary" onClick={send} disabled={disabled || pending || !phone.trim()}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : "Send test"}
      </Button>
    </div>
  );
}
