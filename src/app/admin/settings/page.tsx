import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/ui";
import { SettingsForm } from "@/components/admin/settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: s } = await supabase.from("settings").select("*").eq("id", 1).single();
  if (!s) return <p>Settings row missing.</p>;
  return (
    <>
      <PageTitle>Settings</PageTitle>
      <SettingsForm
        initial={{
          store_name: s.store_name,
          shipping_inside_dhaka: String(s.shipping_inside_dhaka),
          shipping_outside_dhaka: String(s.shipping_outside_dhaka),
          free_shipping_over: s.free_shipping_over?.toString() ?? "",
          bkash_number: s.bkash_number ?? "",
          nagad_number: s.nagad_number ?? "",
          rocket_number: s.rocket_number ?? "",
          payment_instructions: s.payment_instructions,
          contact_phone: s.contact_phone ?? "",
          contact_email: s.contact_email ?? "",
          facebook_url: s.facebook_url ?? "",
          cod_advance: s.cod_advance,
        }}
      />
    </>
  );
}
