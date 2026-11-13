"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Palette, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addFilament, deleteFilament, setFilamentStock, setMaxPrintColors } from "@/app/admin/filaments/actions";
import { Badge, Button, Card, EmptyState, Field, Input } from "@/components/ui";
import type { Filament } from "@/lib/custom";
import { cn } from "@/lib/utils";
import { FilamentSwatch } from "@/components/filament-swatch";

const COMMON_MATERIALS = ["PLA", "PLA+", "PETG", "TPU", "ABS", "Silk PLA"];

export function FilamentManager({ filaments, maxColors }: { filaments: Filament[]; maxColors: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState({ material: "PLA", color: "", hex: "#111111", useHex: true });
  const [max, setMax] = useState(String(maxColors));
  const [confirming, setConfirming] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error?: string }>, ok: string, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.error) return void toast.error(res.error);
      toast.success(ok);
      after?.();
      router.refresh();
    });

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    run(
      () => addFilament({ material: draft.material, color: draft.color, hex: draft.useHex ? draft.hex : "" }),
      "Filament added",
      () => setDraft((d) => ({ ...d, color: "" })),
    );
  };

  const materials = [...new Set(filaments.map((f) => f.material))];
  const inStock = filaments.filter((f) => f.in_stock).length;

  return (
    <div className="grid max-w-4xl gap-6">
      <Card>
        <h2 className="font-semibold">Colors per order</h2>
        <p className="mt-1 text-sm text-ink-soft">
          How many different colors one custom order can use. Set this to the number of printers you run. Customers see it
          as a note on the custom order page.
        </p>
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => setMaxPrintColors(Number(max)), "Saved");
          }}
        >
          <Field label="Maximum colors" className="w-36">
            <Input type="number" min={1} max={16} value={max} onChange={(e) => setMax(e.target.value)} required />
          </Field>
          <Button type="submit" variant="secondary" disabled={pending || Number(max) === maxColors}>
            Save
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-semibold">Add a filament</h2>
        <form onSubmit={add} className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
          <Field label="Material">
            <Input
              list="filament-materials"
              value={draft.material}
              onChange={(e) => setDraft((d) => ({ ...d, material: e.target.value }))}
              placeholder="e.g. PLA"
              required
            />
            <datalist id="filament-materials">
              {[...new Set([...COMMON_MATERIALS, ...materials])].map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
          <Field label="Color name">
            <Input value={draft.color} onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))} placeholder="e.g. Matte Black" required />
          </Field>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filament-hex" className="text-sm font-medium">
              Swatch
            </label>
            <div className="flex h-10 items-center gap-2">
              <input
                id="filament-hex"
                type="color"
                value={draft.hex}
                disabled={!draft.useHex}
                onChange={(e) => setDraft((d) => ({ ...d, hex: e.target.value }))}
                className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-white p-1 disabled:opacity-40"
              />
              <label className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
                <input
                  type="checkbox"
                  className="size-3.5 accent-accent"
                  checked={!draft.useHex}
                  onChange={(e) => setDraft((d) => ({ ...d, useHex: !e.target.checked }))}
                />
                Multi-color
              </label>
            </div>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add
          </Button>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="flex items-baseline justify-between border-b border-line px-5 py-3.5">
          <h2 className="font-semibold">Filament list</h2>
          <p className="text-sm text-ink-soft">
            {inStock} of {filaments.length} available
          </p>
        </div>
        {filaments.length ? (
          <ul className="divide-y divide-line">
            {filaments.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <FilamentSwatch hex={f.hex} className="size-5" />
                <span className={cn("min-w-0 flex-1 basis-40", !f.in_stock && "text-ink-soft")}>
                  <span className="font-medium">{f.color}</span> <span className="text-ink-soft">· {f.material}</span>
                </span>
                {confirming === f.id ? (
                  <>
                    <span className="text-ink-soft">Remove?</span>
                    <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => deleteFilament(f.id), "Filament removed", () => setConfirming(null))}>
                      Remove
                    </Button>
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(null)}>
                      Keep
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge color={f.in_stock ? "success" : "neutral"}>{f.in_stock ? "Available" : "Out of stock"}</Badge>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => run(() => setFilamentStock(f.id, !f.in_stock), f.in_stock ? "Marked out of stock" : "Marked available")}
                    >
                      {f.in_stock ? "Mark out of stock" : "Mark available"}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-ink-soft hover:text-danger" onClick={() => setConfirming(f.id)} aria-label={`Remove ${f.color} ${f.material}`}>
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Palette}
            title="No filaments yet"
            text="Add the filaments you have. Available ones are shown to customers on the custom order page."
          />
        )}
      </Card>
    </div>
  );
}
