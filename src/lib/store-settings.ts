import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** Public store settings (fees, contact) used by policy pages. Cached per request. */
export const getStoreSettings = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("store_name, shipping_inside_dhaka, shipping_outside_dhaka, free_shipping_over, contact_phone, contact_email, facebook_url, cod_advance")
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
  };
});
