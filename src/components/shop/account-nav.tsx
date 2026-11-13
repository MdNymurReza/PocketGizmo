"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LogOut, MapPin, Package, PenTool, Settings, ShieldCheck } from "lucide-react";
import { logout } from "@/app/(shop)/(auth)/actions";
import { cn } from "@/lib/utils";

export const ACCOUNT_LINKS = [
  { href: "/account", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/requests", label: "Custom requests", icon: PenTool },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/settings", label: "Settings", icon: Settings },
] as const;

/** Account menu: a sidebar on desktop, a scrollable tab row on mobile. */
export function AccountNav({ isAdmin, badges = {} }: { isAdmin: boolean; badges?: Record<string, number> }) {
  const path = usePathname();
  const item =
    "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap";

  return (
    <nav aria-label="Account" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
      {ACCOUNT_LINKS.map(({ href, label, icon: Icon, ...rest }) => {
        const active = "exact" in rest ? path === href : path.startsWith(href);
        const badge = badges[href] ?? 0;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(item, active ? "bg-ink text-white" : "text-ink-soft hover:bg-surface hover:text-ink")}
          >
            <Icon className="size-4" strokeWidth={1.75} />
            {label}
            {badge > 0 && (
              <span
                className={cn(
                  "ml-auto grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                  active ? "bg-white text-ink" : "bg-accent text-white",
                )}
                aria-label={`${badge} waiting for you`}
              >
                {badge}
              </span>
            )}
          </Link>
        );
      })}

      <div className="hidden lg:my-2 lg:block lg:border-t lg:border-line" />

      {isAdmin && (
        <Link href="/admin" className={cn(item, "text-ink-soft hover:bg-surface hover:text-ink")}>
          <ShieldCheck className="size-4" strokeWidth={1.75} />
          Store admin
        </Link>
      )}
      <form action={logout} className="shrink-0">
        <button type="submit" className={cn(item, "w-full text-ink-soft hover:bg-surface hover:text-ink")}>
          <LogOut className="size-4" strokeWidth={1.75} />
          Log out
        </button>
      </form>
    </nav>
  );
}
