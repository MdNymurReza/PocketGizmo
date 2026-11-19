"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/server";
import { sendSms } from "@/lib/sms";

const wallet = z
  .string()
  .trim()
  .transform((v) => v || null)
  .refine((v) => v === null || /^01[3-9]\d{8}(-\d)?$/.test(v), "Wallet numbers must look like 01XXXXXXXXX (Rocket may end in -X)");

const schema = z.object({
  store_name: z.string().trim().min(1).max(60),
  shipping_inside_dhaka: z.coerce.number().min(0),
  shipping_outside_dhaka: z.coerce.number().min(0),
  free_shipping_over: z.union([z.coerce.number().min(0), z.literal("")]).transform((v) => (v === "" ? null : Number(v))),
  bkash_number: wallet,
  nagad_number: wallet,
  rocket_number: wallet,
  payment_instructions: z.string().trim().max(500),
  contact_phone: z.string().trim().max(30).transform((v) => v || null),
  contact_email: z.union([z.email("Enter a valid email"), z.literal("")]).transform((v) => v || null),
  facebook_url: z.union([z.url("Enter a full URL starting with https://"), z.literal("")]).transform((v) => v || null),
  cod_advance: z.enum(["off", "outside_dhaka", "all"]),
  whatsapp_number: z
    .string()
    .trim()
    .max(20)
    .refine((v) => !v || /^(?:\+?88)?01[3-9]\d{8}$/.test(v.replace(/[\s-]/g, "")), "WhatsApp number must look like 01XXXXXXXXX")
    .transform((v) => v || null),
  messenger_url: z
    .union([z.url("Enter a full Messenger link starting with https://"), z.literal("")])
    .refine((v) => !v || /^https?:\/\/(www\.)?(m\.me|messenger\.com|(m\.|web\.)?facebook\.com|fb\.com)\//i.test(v), "Use your m.me link (e.g. https://m.me/yourpage) or your Facebook page link")
    .transform((v) => v || null),
  gift_enabled: z.boolean(),
  gift_wrap_fee: z.coerce.number().min(0).max(10000),
  sms_enabled: z.boolean(),
  sms_events: z.array(z.string()).max(10).transform((a) => [...new Set(a)].filter((k) => ["placed", "confirmed", "shipped", "delivered", "cancelled", "back_in_stock"].includes(k))),
  points_enabled: z.boolean(),
  points_spend_per_point: z.coerce.number().min(1, "Points: spend per point must be at least ৳1").max(100000),
  points_review: z.coerce.number().int().min(0).max(10000),
  points_max_pct: z.coerce.number().int().min(0).max(100),
});

export type SettingsInput = z.input<typeof schema>;

export async function saveSettings(input: SettingsInput): Promise<{ error?: string }> {
  try {
    const { supabase } = await requireAdmin();
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const real = (n: string | null) => n !== null && !/X{4,}/i.test(n);
    const d = parsed.data;
    if (d.cod_advance !== "off" && ![d.bkash_number, d.nagad_number, d.rocket_number].some(real)) {
      return { error: "Add at least one real bKash, Nagad or Rocket number before turning on COD advance." };
    }
    const { error } = await supabase.from("settings").update(parsed.data).eq("id", 1);
    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Sends one test message so the admin can check the BulkSMSBD keys and balance. */
export async function sendTestSms(phone: string): Promise<{ error?: string }> {
  try {
    const { supabase } = await requireAdmin();
    const { data: st } = await supabase.from("settings").select("store_name").eq("id", 1).single();
    const message = `${st?.store_name ?? "PocketGizmo"}: This is a test message. SMS updates are working.`;
    const res = await sendSms(phone, message);
    await supabase.from("sms_log").insert({ phone: phone.replace(/\D/g, "").slice(-11), event: "test", message, ok: res.ok, error: res.error ?? null });
    revalidatePath("/admin/settings");
    return res.ok ? {} : { error: res.error ?? "SMS failed" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
