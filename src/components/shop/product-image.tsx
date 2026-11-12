import Image from "next/image";
import { cn } from "@/lib/utils";

/** Product photo, or a neutral placeholder when there's no photo yet. */
export function ProductImage({
  src,
  alt,
  sizes,
  priority,
  className,
  imgClassName,
  hoverSrc,
}: {
  src?: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  /** Extra classes for the <img> itself (e.g. a hover zoom). */
  imgClassName?: string;
  /** Optional second photo that fades in when a parent `.group` is hovered. */
  hoverSrc?: string | null;
}) {
  if (src) {
    return (
      <div className={cn("relative overflow-hidden bg-surface", className)}>
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={cn("object-cover", imgClassName)} />
        {hoverSrc && (
          <Image
            src={hoverSrc}
            alt=""
            fill
            sizes={sizes}
            className={cn("object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100", imgClassName)}
          />
        )}
      </div>
    );
  }
  return (
    <div
      className={cn("relative grid place-items-center overflow-hidden bg-gradient-to-br from-surface to-surface-2", className)}
      role="img"
      aria-label={alt}
    >
      <svg viewBox="0 0 24 24" className="w-1/4 max-w-16 text-ink/15" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" aria-hidden>
        <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
        <path d="M4 7.5 12 12l8-4.5M12 12v9" />
      </svg>
    </div>
  );
}
