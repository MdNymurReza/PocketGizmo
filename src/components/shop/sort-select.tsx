"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui";

export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <label className="flex items-center gap-2 text-sm text-ink-soft">
      Sort by
      <Select
        className="h-9 w-auto text-ink"
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          if (e.target.value) next.set("sort", e.target.value);
          else next.delete("sort");
          next.delete("page");
          router.push(`${pathname}?${next}`);
        }}
      >
        <option value="">Featured</option>
        <option value="price-asc">Price: low to high</option>
        <option value="price-desc">Price: high to low</option>
        <option value="name">Name</option>
      </Select>
    </label>
  );
}
