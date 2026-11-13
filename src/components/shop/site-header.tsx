import Link from "next/link";
import { getSessionProfile } from "@/lib/supabase/server";
import { AccountMenu } from "./account-menu";
import { Logo, buttonStyles } from "@/components/ui";
import { CartButton } from "./cart-button";
import { MobileNav } from "./mobile-nav";
import { HeaderShell } from "./header-shell";
import { NavLink } from "./nav-link";

const NAV = [
  { href: "/shop", label: "Shop" },
  { href: "/custom-order", label: "Custom Print" },
  { href: "/track", label: "Track Order" },
];

export async function SiteHeader() {
  const { supabase, user, profile } = await getSessionProfile();
  const { data: settings } = await supabase.from("settings").select("free_shipping_over").eq("id", 1).single();
  const freeOver = settings?.free_shipping_over != null ? Number(settings.free_shipping_over) : null;

  return (
    <>
      <div className="bg-ink text-white">
        <p className="mx-auto max-w-7xl px-4 py-2 text-center text-xs font-medium tracking-wide sm:px-6">
          {freeOver != null
            ? `Free delivery on orders over ৳${freeOver.toLocaleString("en-IN")} · Cash on delivery available`
            : "Cash on delivery available across Bangladesh · bKash · Nagad · Rocket"}
        </p>
      </div>
      <HeaderShell>
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 transition-[height] duration-300 group-data-[scrolled]/header:h-14 sm:px-6">
          <MobileNav links={NAV} />
          <Link href="/" aria-label="PocketGizmo home" className="mr-4 shrink-0 sm:mr-6">
            <Logo priority className="h-12 transition-[height] duration-300 group-data-[scrolled]/header:h-10" />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink key={n.href} href={n.href}>{n.label}</NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            {profile?.role === "admin" && (
              <Link href="/admin" className={buttonStyles({ variant: "secondary", size: "sm", className: "mr-2 hidden sm:inline-flex" })}>
                Admin
              </Link>
            )}
            <AccountMenu
              user={user ? { name: profile?.full_name ?? "", email: user.email ?? "", isAdmin: profile?.role === "admin" } : null}
            />
            <CartButton />
          </div>
        </div>
      </HeaderShell>
    </>
  );
}
