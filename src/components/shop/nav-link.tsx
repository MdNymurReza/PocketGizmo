"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Header link with an underline that glides between the active items. */
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = path === href || path.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active ? "text-ink" : "text-ink-soft hover:text-ink",
      )}
    >
      {children}
      {active && (
        <motion.span
          layoutId="nav-underline"
          className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-ink"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
      )}
    </Link>
  );
}
