import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, LogOut } from "lucide-react";
import { getSessionProfile } from "@/lib/supabase/server";
import { logout } from "@/app/(shop)/(auth)/actions";
import { Logo } from "@/components/ui";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · PocketGizmo" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile } = await getSessionProfile();
  if (!user) redirect("/login?next=/admin");
  if (profile?.role !== "admin") redirect("/account");

  // Counts for the sidebar badges: things that are waiting on the admin.
  const [pendingOrders, newRequests, pendingReviews] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("custom_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const badges = {
    "/admin/orders": pendingOrders.count ?? 0,
    "/admin/custom-requests": newRequests.count ?? 0,
    "/admin/reviews": pendingReviews.count ?? 0,
  };

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-line bg-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-2 p-4">
          <Link href="/admin" aria-label="Admin home" className="flex items-center gap-2">
            <Logo priority className="h-11" />
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-ink-soft uppercase">Admin</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink lg:hidden">
            Store <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
        <AdminNav badges={badges} />
        <div className="mt-auto hidden border-t border-line p-4 lg:block">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
            View store <ArrowUpRight className="size-3.5" />
          </Link>
          <div className="mt-4 flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs text-ink-soft" title={user.email ?? undefined}>
              {profile?.full_name || user.email}
            </p>
            <form action={logout}>
              <button type="submit" className="grid size-8 place-items-center rounded-md text-ink-soft hover:bg-surface hover:text-ink" aria-label="Sign out" title="Sign out">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 bg-surface px-4 py-6 sm:px-8 lg:py-8">{children}</main>
    </div>
  );
}
