import { cn } from "@/lib/utils";

/** Color dot for a filament. Filaments without a single color (e.g. rainbow silk) get a multi-color dot. */
export function FilamentSwatch({ hex, className }: { hex: string | null; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-4 shrink-0 rounded-full border border-ink/15",
        !hex && "bg-[conic-gradient(#f87171,#facc15,#4ade80,#60a5fa,#c084fc,#f87171)]",
        className,
      )}
      style={hex ? { background: hex } : undefined}
    />
  );
}
