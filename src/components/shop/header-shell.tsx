"use client";

import { useState } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";
import { cn } from "@/lib/utils";

/** Sticky header that tightens and gains a soft shadow once the page scrolls. */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 8));

  return (
    <header
      data-scrolled={scrolled || undefined}
      className={cn(
        "group/header sticky top-0 z-40 border-b backdrop-blur-md transition-[background-color,box-shadow,border-color] duration-300",
        scrolled ? "border-line bg-white/90 shadow-[0_1px_12px_rgba(11,11,15,0.06)]" : "border-transparent bg-white/70",
      )}
    >
      {children}
    </header>
  );
}
