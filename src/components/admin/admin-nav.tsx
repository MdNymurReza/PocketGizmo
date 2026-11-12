"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { BarChart3, Boxes, Package, PenTool, ReceiptText, Settings, Tags, TicketPercent } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Dashboard", icon: BarChart3, exact: true },
  { href: "/admin/orders", label: "Orders", icon: ReceiptText },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: Tags },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/custom-requests", label: "Custom requests", icon: PenTool },
  { href: "/admin/coupons", label: "Coupons", icon: TicketPercent },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminNav({ badges = {} }: { badges?: Record<string, number> }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
      {LINKS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? path === href : path.startsWith(href);
        const badge = badges[href] ?? 0;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active ? "text-ink" : "text-ink-soft hover:bg-surface hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId="admin-nav-active"
                className="absolute inset-0 -z-0 rounded-md bg-surface-2"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <Icon className="relative size-4" />
            <span className="relative">{label}</span>
            {badge > 0 && (
              <span
                className="relative ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white tabular-nums"
                aria-label={`${badge} waiting`}
              >
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
