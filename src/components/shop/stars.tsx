import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Read-only star rating. Supports fractions (e.g. 4.3) by clipping the filled row. */
export function Stars({ rating, className, size = "size-4" }: { rating: number; className?: string; size?: string }) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  const row = (cls: string) => (
    <span className="flex gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} className={cn(size, "shrink-0", cls)} strokeWidth={0} />
      ))}
    </span>
  );
  return (
    <span className={cn("relative inline-flex", className)} role="img" aria-label={`${Number(rating.toFixed(1))} out of 5 stars`}>
      {row("fill-surface-2")}
      <span className="absolute inset-0 overflow-hidden" style={{ width: `${pct}%` }} aria-hidden>
        {row("fill-amber-400")}
      </span>
    </span>
  );
}
