"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAddress, saveAddress, setDefaultAddress } from "@/app/(shop)/account/actions";
import { BD_DISTRICTS, ZONE_LABEL, type Zone } from "@/lib/bd";
import { Badge, Button, Card, Checkbox, EmptyState, Field, Input, Select } from "@/components/ui";
import { EASE } from "@/components/motion";

export type Address = { id: string; name: string; phone: string; district: string; area: string; line: string; zone: Zone; is_default: boolean };

type Draft = Omit<Address, "id"> & { id?: string };
const blank = (defaults: { name: string; phone: string }): Draft => ({
  ...defaults,
  district: "",
  area: "",
  line: "",
  zone: "inside_dhaka",
  is_default: false,
});

export function AddressBook({ addresses, defaults }: { addresses: Address[]; defaults: { name: string; phone: string } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<string | null>(null);

  const open = (d: Draft) => {
    setErrors({});
    setConfirming(null);
    setDraft(d);
  };
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setDraft((d) => (d ? { ...d, [k]: e.target.value } : d));
    setErrors((er) => ({ ...er, [k]: "" }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    start(async () => {
      const res = await saveAddress(draft);
      if (res.error) {
        if (res.field) setErrors({ [res.field]: res.error });
        return void toast.error(res.error);
      }
      toast.success(draft.id ? "Address updated" : "Address saved");
      setDraft(null);
      router.refresh();
    });
  };

  const run = (fn: () => Promise<{ error?: string }>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (res.error) return void toast.error(res.error);
      toast.success(ok);
      setConfirming(null);
      router.refresh();
    });

  return (
    <div className="grid gap-4">
      {!draft && (
        <div>
          <Button size="sm" onClick={() => open(blank(defaults))}>
            <Plus className="size-4" /> Add address
          </Button>
        </div>
      )}

      <AnimatePresence initial={false}>
        {draft && (
          <motion.div
            key="form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <Card>
              <h2 className="font-semibold">{draft.id ? "Edit address" : "New address"}</h2>
              <form onSubmit={submit} noValidate className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Recipient name" error={errors.name}>
                  <Input value={draft.name} onChange={set("name")} autoComplete="name" required />
                </Field>
                <Field label="Mobile number" error={errors.phone}>
                  <Input value={draft.phone} onChange={set("phone")} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" autoComplete="tel" required />
                </Field>
                <Field label="District" error={errors.district}>
                  <Select
                    value={draft.district}
                    onChange={(e) => {
                      const district = e.target.value;
                      setDraft((d) => (d ? { ...d, district, zone: district === "Dhaka" ? "inside_dhaka" : "outside_dhaka" } : d));
                      setErrors((er) => ({ ...er, district: "" }));
                    }}
                    required
                  >
                    <option value="" disabled>
                      Select district
                    </option>
                    {BD_DISTRICTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Area / Thana" error={errors.area}>
                  <Input value={draft.area} onChange={set("area")} placeholder="e.g. Mirpur 10" required />
                </Field>
                <Field label="Street address" error={errors.line} className="sm:col-span-2">
                  <Input value={draft.line} onChange={set("line")} placeholder="House, road, block, landmark" autoComplete="street-address" required />
                </Field>
                <Field label="Delivery area" hint="Sets the delivery charge at checkout">
                  <Select value={draft.zone} onChange={set("zone")}>
                    {(Object.keys(ZONE_LABEL) as Zone[]).map((z) => (
                      <option key={z} value={z}>
                        {ZONE_LABEL[z]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="flex items-end pb-2.5">
                  <Checkbox
                    label="Use as my default address"
                    checked={draft.is_default}
                    onChange={(e) => setDraft((d) => (d ? { ...d, is_default: e.target.checked } : d))}
                  />
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" disabled={pending}>
                    {pending && <Loader2 className="size-4 animate-spin" />}
                    {draft.id ? "Save changes" : "Save address"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setDraft(null)} disabled={pending}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {addresses.length ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id}>
              <Card className="flex h-full flex-col text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{a.name}</p>
                  {a.is_default && <Badge color="accent">Default</Badge>}
                </div>
                <p className="mt-1 text-ink-soft">
                  {a.line}
                  <br />
                  {a.area}, {a.district}
                  <br />
                  {a.phone} · {ZONE_LABEL[a.zone]}
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-1 pt-4">
                  {confirming === a.id ? (
                    <>
                      <span className="mr-1 text-ink-soft">Delete this address?</span>
                      <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => deleteAddress(a.id), "Address deleted")}>
                        Delete
                      </Button>
                      <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(null)}>
                        Keep
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => open(a)}>
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                      {!a.is_default && (
                        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setDefaultAddress(a.id), "Default address updated")}>
                          <Star className="size-3.5" /> Make default
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="ml-auto text-ink-soft hover:text-danger" onClick={() => setConfirming(a.id)} aria-label={`Delete address for ${a.name}`}>
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        !draft && (
          <Card className="p-0">
            <EmptyState icon={MapPin} title="No saved addresses" text="Save an address to check out faster next time." />
          </Card>
        )
      )}
    </div>
  );
}
