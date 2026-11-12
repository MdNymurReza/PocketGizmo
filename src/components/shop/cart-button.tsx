"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { cartCount, useCart } from "@/lib/cart-store";
import { buttonStyles } from "@/components/ui";

export function CartButton() {
  const items = useCart((s) => s.items);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const count = mounted ? cartCount(items) : 0;

  // Nudge the bag whenever the count goes up (but not on first load).
  const controls = useAnimationControls();
  const prev = useRef<number | null>(null);
  useEffect(() => {
    if (!mounted) return;
    if (prev.current !== null && count > prev.current) {
      controls.start({ rotate: [0, -12, 10, -6, 0], scale: [1, 1.15, 1], transition: { duration: 0.5 } });
    }
    prev.current = count;
  }, [count, mounted, controls]);

  return (
    <Link href="/cart" className={buttonStyles({ variant: "ghost", size: "icon", className: "relative" })} aria-label={`Cart, ${count} items`}>
      <motion.span animate={controls} className="inline-flex">
        <ShoppingBag className="size-5" strokeWidth={1.75} />
      </motion.span>
      <AnimatePresence>
        {count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: "spring", stiffness: 600, damping: 22 }}
            className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white"
          >
            {count}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}
