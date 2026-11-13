import Link from "next/link";
import { Logo } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { POLICY_PAGES } from "@/lib/policy";

const COLUMNS = [
  {
    title: "Shop",
    links: [
      { href: "/shop", label: "All products" },
      { href: "/custom-order", label: "Custom printing" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/track", label: "Track your order" },
      { href: "/account", label: "My account" },
    ],
  },
  { title: "Policies", links: [...POLICY_PAGES] },
];

export async function SiteFooter() {
  const supabase = await createClient();
  const { data: s } = await supabase.from("settings").select("contact_phone, contact_email, facebook_url").eq("id", 1).single();

  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr_1.2fr]">
        <div>
          <Logo className="h-24" />
          <p className="mt-4 text-sm font-medium">Little Gadgets. Big Smiles.</p>
          <p className="mt-1 max-w-xs text-sm text-ink-soft">
            3D-printed accessories, designed and made to order in Bangladesh.
          </p>
          <ul className="mt-4 space-y-1 text-sm text-ink-soft">
            {s?.contact_phone && <li><a href={`tel:${s.contact_phone}`} className="hover:text-ink">{s.contact_phone}</a></li>}
            {s?.contact_email && <li><a href={`mailto:${s.contact_email}`} className="hover:text-ink">{s.contact_email}</a></li>}
            {s?.facebook_url && <li><a href={s.facebook_url} target="_blank" rel="noopener noreferrer" className="hover:text-ink">Facebook</a></li>}
          </ul>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h2 className="text-sm font-semibold">{col.title}</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-soft">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-ink">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <h2 className="text-sm font-semibold">Payment methods</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {["bKash", "Nagad", "Rocket", "Cash on Delivery"].map((m) => (
              <li key={m} className="rounded-md border border-line bg-white px-2 py-1 text-xs font-medium text-ink-soft">
                {m}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-ink-soft sm:px-6">
          © {new Date().getFullYear()} PocketGizmo. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
