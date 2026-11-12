"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/server";

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
