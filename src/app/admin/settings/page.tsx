import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/ui";
import { SettingsForm } from "@/components/admin/settings-form";
import { SMS_EVENTS, smsConfigured } from "@/lib/sms";
import { steadfastConfigured } from "@/lib/steadfast";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const [{ data: s }, { data: smsLog }] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).single(),
    supabase.from("sms_log").select("id, phone, event, ok, error, created_at").order("created_at", { ascending: false }).limit(8),
  ]);
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
          whatsapp_number: s.whatsapp_number ?? "",
          messenger_url: s.messenger_url ?? "",
          gift_enabled: s.gift_enabled,
          gift_wrap_fee: String(s.gift_wrap_fee),
          sms_enabled: s.sms_enabled,
          sms_events: s.sms_events,
          points_enabled: s.points_enabled,
          points_spend_per_point: String(s.points_spend_per_point),
          points_review: String(s.points_review),
          points_max_pct: String(s.points_max_pct),
        }}
        status={{ smsReady: smsConfigured(), steadfastReady: steadfastConfigured(), smsEvents: SMS_EVENTS, smsLog: smsLog ?? [] }}
      />
    </>
  );
}
