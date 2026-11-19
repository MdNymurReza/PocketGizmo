"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui";

export type PickerProduct = { id: string; name: string; is_active: boolean };

/** Search and tick products. Picked ones stay at the top. */
export function ProductPicker({ products, value, onChange }: { products: PickerProduct[]; value: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState("");
  const picked = useMemo(() => new Set(value), [value]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products
      .filter((p) => !needle || p.name.toLowerCase().includes(needle))
      .sort((a, b) => Number(picked.has(b.id)) - Number(picked.has(a.id)) || a.name.localeCompare(b.name));
  }, [products, q, picked]);

  return (
    <div className="rounded-lg border border-line">
      <div className="relative border-b border-line">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${products.length} products`} className="border-0 pl-9 shadow-none" aria-label="Search products" />
      </div>
      <ul className="max-h-64 overflow-y-auto p-1 text-sm">
        {list.map((p) => (
          <li key={p.id}>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-surface">
              <input
                type="checkbox"
                className="size-4 accent-accent"
                checked={picked.has(p.id)}
                onChange={(e) => onChange(e.target.checked ? [...value, p.id] : value.filter((id) => id !== p.id))}
              />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {!p.is_active && <span className="text-xs text-ink-soft">hidden</span>}
            </label>
          </li>
        ))}
        {!list.length && <li className="px-2 py-3 text-ink-soft">No products match.</li>}
      </ul>
      <p className="border-t border-line px-3 py-2 text-xs text-ink-soft">{value.length} picked</p>
    </div>
  );
}
