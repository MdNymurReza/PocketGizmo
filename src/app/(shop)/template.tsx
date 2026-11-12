"use client";

import { motion } from "motion/react";
import { EASE } from "@/components/motion";

/** Soft fade between storefront pages (templates re-mount on every navigation). */
export default function ShopTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}>
      {children}
    </motion.div>
  );
}
