import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/supabase/server";
import { AddressBook } from "@/components/shop/address-book";

export const metadata: Metadata = { title: "Addresses" };

export default async function AccountAddressesPage() {
  const { supabase, user, profile } = await getSessionProfile();
  if (!user) redirect("/login?next=/account/addresses");
  const { data: addresses } = await supabase
    .from("addresses")
    .select("id, name, phone, district, area, line, zone, is_default")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-semibold sm:text-3xl">Addresses</h1>
      <p className="mt-1 text-sm text-ink-soft">Saved delivery addresses. Your default one is filled in at checkout.</p>
      <div className="mt-6">
        <AddressBook addresses={addresses ?? []} defaults={{ name: profile?.full_name ?? "", phone: profile?.phone ?? "" }} />
      </div>
    </div>
  );
}
