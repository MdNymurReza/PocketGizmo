import { cn } from "@/lib/utils";

export function Bone({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} aria-hidden />;
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Bone className="aspect-[4/5] rounded-xl" />
          <Bone className="mt-3 h-4 w-3/4" />
          <Bone className="mt-2 h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

/** Wraps a skeleton with the right screen-reader semantics. */
export function Loading({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
