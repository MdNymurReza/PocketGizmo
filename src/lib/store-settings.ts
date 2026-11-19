import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** Public store settings (fees, contact) used by policy pages. Cached per request. */
export const getStoreSettings = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("store_name, shipping_inside_dhaka, shipping_outside_dhaka, free_shipping_over, contact_phone, contact_email, facebook_url, cod_advance, whatsapp_number, messenger_url")
    .eq("id", 1)
    .single();
  return {
    storeName: data?.store_name ?? "PocketGizmo",
    insideDhaka: Number(data?.shipping_inside_dhaka ?? 70),
    outsideDhaka: Number(data?.shipping_outside_dhaka ?? 130),
    freeOver: data?.free_shipping_over != null ? Number(data.free_shipping_over) : null,
    phone: data?.contact_phone ?? null,
    email: data?.contact_email ?? null,
    facebook: data?.facebook_url ?? null,
    codAdvance: data?.cod_advance ?? "off",
    whatsappLink: whatsappLink(data?.whatsapp_number || data?.contact_phone),
    messengerLink: messengerLink(data?.messenger_url || data?.facebook_url),
  };
});

/** wa.me link for a Bangladeshi mobile number. */
function whatsappLink(phone: string | null | undefined) {
  const d = (phone ?? "").replace(/\D/g, "").slice(-11);
  return /^01[3-9]\d{8}$/.test(d) ? `https://wa.me/88${d}` : null;
}

/** m.me link from a Messenger link, or from the Facebook page address (facebook.com/yourpage). */
function messengerLink(url: string | null | undefined) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === "m.me" || u.hostname.endsWith("messenger.com")) return u.toString();
    if (!/(^|\.)facebook\.com$|(^|\.)fb\.com$/.test(u.hostname)) return null;
    const id = u.searchParams.get("id");
    if (u.pathname.startsWith("/profile.php") && id) return `https://m.me/${id}`;
    const page = u.pathname.split("/").filter(Boolean)[0];
    return page && !["pages", "groups", "share"].includes(page) ? `https://m.me/${page}` : null;
  } catch {
    return null;
  }
}
