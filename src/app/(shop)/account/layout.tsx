import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/supabase/server";
import { AccountNav } from "@/components/shop/account-nav";

export const metadata: Metadata = { title: { default: "My account", template: "%s · My account · PocketGizmo" }, robots: { index: false } };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile } = await getSessionProfile();
  if (!user) redirect("/login?next=/account");

  // Quotes waiting for the customer's answer show as a badge in the menu.
  const { count: quotes } = await supabase
    .from("custom_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "quoted");

  const name = profile?.full_name?.trim() || "";
  const initials = (name || user.email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="grid gap-6 lg:grid-cols-[230px_1fr] lg:gap-12">
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="mb-4 flex items-center gap-3 lg:mb-6">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-sm font-semibold text-white" aria-hidden>
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{name || "My account"}</p>
              <p className="truncate text-sm text-ink-soft">{user.email}</p>
            </div>
          </div>
          <AccountNav isAdmin={profile?.role === "admin"} badges={{ "/account/requests": quotes ?? 0 }} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
