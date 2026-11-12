"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductImage } from "./product-image";
import { EASE } from "@/components/motion";
import { cn } from "@/lib/utils";

export function Gallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const many = images.length > 1;
  const go = (d: number) => setActive((i) => (i + d + images.length) % images.length);

  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row">
      {many && (
        <div className="flex gap-3 overflow-x-auto sm:flex-col">
          {images.map((src, i) => (
            <button
              key={src}
              onClick={() => setActive(i)}
              aria-label={`Show photo ${i + 1} of ${images.length}`}
              aria-pressed={i === active}
              className={cn(
                "shrink-0 rounded-lg ring-offset-2 transition",
                i === active ? "ring-2 ring-ink" : "opacity-60 hover:opacity-100",
              )}
            >
              <ProductImage src={src} alt="" sizes="80px" className="size-16 rounded-lg sm:size-20" />
            </button>
          ))}
        </div>
      )}
      <div
        className="group relative aspect-square flex-1 overflow-hidden rounded-2xl bg-surface"
        onKeyDown={(e) => {
          if (!many) return;
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={active}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <ProductImage src={images[active]} alt={name} sizes="(min-width: 1024px) 50vw, 100vw" priority className="size-full" />
          </motion.div>
        </AnimatePresence>
        {many && (
          <>
            {[-1, 1].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => go(d)}
                aria-label={d < 0 ? "Previous photo" : "Next photo"}
                className={cn(
                  "absolute top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-md backdrop-blur transition-opacity focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
                  d < 0 ? "left-3" : "right-3",
                )}
              >
                {d < 0 ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
              </button>
            ))}
            <span className="absolute right-3 bottom-3 rounded-md bg-white/90 px-2 py-0.5 text-xs font-medium tabular-nums shadow-xs">
              {active + 1} / {images.length}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
