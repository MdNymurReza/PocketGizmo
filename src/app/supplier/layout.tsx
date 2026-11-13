import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, LogOut } from "lucide-react";
import { getSessionProfile } from "@/lib/supabase/server";
import { logout } from "@/app/(shop)/(auth)/actions";
import { Logo } from "@/components/ui";

export const metadata: Metadata = { title: { default: "Print jobs", template: "%s · Supplier · PocketGizmo" }, robots: { index: false } };

export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getSessionProfile();
  if (!user) redirect("/login?next=/supplier");
  // The admin may look at the supplier's view too.
  if (profile?.role !== "supplier" && profile?.role !== "admin") redirect("/account");

  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/supplier" aria-label="Print jobs home" className="flex items-center gap-2">
            <Logo priority className="h-11" />
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-ink-soft uppercase">Supplier</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <p className="hidden max-w-48 truncate text-ink-soft sm:block" title={user.email ?? undefined}>
              {profile?.full_name || user.email}
            </p>
            {profile?.role === "admin" && (
              <Link href="/admin/supplier" className="text-ink-soft hover:text-ink">
                Admin view
              </Link>
            )}
            <Link href="/" className="inline-flex items-center gap-1 text-ink-soft hover:text-ink">
              Store <ArrowUpRight className="size-3.5" />
            </Link>
            <form action={logout}>
              <button type="submit" className="grid size-8 place-items-center rounded-md text-ink-soft hover:bg-surface hover:text-ink" aria-label="Sign out" title="Sign out">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </div>
  );
}
