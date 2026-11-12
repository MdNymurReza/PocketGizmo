import type { Metadata } from "next";
import { getSessionProfile } from "@/lib/supabase/server";
import { CheckoutForm } from "@/components/shop/checkout-form";

/** Placeholder numbers (e.g. 01XXXXXXXXX) are treated as not configured. */
const realNumber = (n: string | null | undefined) => (n && !/X{4,}/i.test(n) ? n : null);

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const { supabase, user, profile } = await getSessionProfile();
  const [{ data: settings }, { data: addresses }] = await Promise.all([
    supabase
      .from("settings")
      .select("shipping_inside_dhaka, shipping_outside_dhaka, free_shipping_over, bkash_number, nagad_number, rocket_number, payment_instructions, cod_advance")
      .eq("id", 1)
      .single(),
    user
      ? supabase.from("addresses").select("id, name, phone, district, area, line, zone, is_default").order("is_default", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold">Checkout</h1>
      <CheckoutForm
        settings={{
          insideDhaka: Number(settings?.shipping_inside_dhaka ?? 70),
          outsideDhaka: Number(settings?.shipping_outside_dhaka ?? 130),
          freeOver: settings?.free_shipping_over != null ? Number(settings.free_shipping_over) : null,
          wallets: {
            bkash: realNumber(settings?.bkash_number),
            nagad: realNumber(settings?.nagad_number),
            rocket: realNumber(settings?.rocket_number),
          },
          instructions: settings?.payment_instructions ?? "",
          codAdvance: settings?.cod_advance ?? "off",
        }}
        signedIn={Boolean(user)}
        defaults={{ name: profile?.full_name ?? "", phone: profile?.phone ?? "", email: user?.email ?? "" }}
        addresses={addresses ?? []}
      />
    </div>
  );
}
