"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { BarChart3, Boxes, Package, Palette, PenTool, Printer, ReceiptText, Settings, Star, Store, Tags, TicketPercent } from "lucide-react";
import { cn } from "@/lib/utils";

const GROUPS = [
  { label: null, links: [{ href: "/admin", label: "Dashboard", icon: BarChart3, exact: true }] },
  {
    label: "Sales",
    links: [
      { href: "/admin/orders", label: "Orders", icon: ReceiptText },
      { href: "/admin/stall", label: "Stall orders", icon: Store },
      { href: "/admin/custom-requests", label: "Custom requests", icon: PenTool },
      { href: "/admin/supplier", label: "Supplier", icon: Printer },
      { href: "/admin/reviews", label: "Reviews", icon: Star },
    ],
  },
  {
    label: "Catalog",
    links: [
      { href: "/admin/products", label: "Products", icon: Package },
      { href: "/admin/categories", label: "Categories", icon: Tags },
      { href: "/admin/inventory", label: "Inventory", icon: Boxes },
      { href: "/admin/filaments", label: "Filaments", icon: Palette },
    ],
  },
  {
    label: "Store",
    links: [
      { href: "/admin/coupons", label: "Coupons", icon: TicketPercent },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
] as const;

/** Admin menu, grouped by job. A sidebar on desktop, a scrollable row on mobile. */
export function AdminNav({ badges = {} }: { badges?: Record<string, number> }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:gap-0 lg:overflow-visible">
      {GROUPS.map((group, gi) => (
        <div key={gi} className="flex shrink-0 gap-1 lg:flex-col lg:gap-0.5" role="group" aria-label={group.label ?? undefined}>
          {group.label && (
            <p className="hidden px-3 pt-5 pb-1.5 text-[11px] font-semibold tracking-wider text-ink-soft/80 uppercase lg:block">{group.label}</p>
          )}
          {group.links.map(({ href, label, icon: Icon, ...rest }) => {
            const active = "exact" in rest ? path === href : path.startsWith(href);
            const badge = badges[href] ?? 0;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "text-ink" : "text-ink-soft hover:bg-surface hover:text-ink",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="admin-nav-active"
                    className="absolute inset-0 rounded-md bg-surface-2"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <Icon className="relative size-4" strokeWidth={1.75} />
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
        </div>
      ))}
    </nav>
  );
}
