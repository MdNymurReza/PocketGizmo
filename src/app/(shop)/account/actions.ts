"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionProfile } from "@/lib/supabase/server";
import { BD_DISTRICTS, BD_PHONE_RE, normalizePhone } from "@/lib/bd";

export type ProfileState = { error?: string; ok?: boolean } | undefined;

const schema = z.object({
  full_name: z.string().trim().min(2, "Please enter your name"),
  phone: z.string().trim().regex(/^(?:\+?88)?01[3-9]\d{8}$/, "Enter a valid Bangladeshi mobile number"),
});

export async function updateProfile(_: ProfileState, formData: FormData): Promise<ProfileState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, user } = await getSessionProfile();
  if (!user) return { error: "Please log in again" };
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/account", "layout");
  return { ok: true };
}

export async function changePassword(_: ProfileState, formData: FormData): Promise<ProfileState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters" };
  if (password !== formData.get("confirm")) return { error: "Passwords don't match" };
  const { supabase, user } = await getSessionProfile();
  if (!user) return { error: "Please log in again" };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { ok: true };
}

// ---------- Address book ----------

const MAX_ADDRESSES = 10;

const addressSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Enter the recipient's name").max(80),
  phone: z.string().trim().regex(BD_PHONE_RE, "Enter a valid mobile number (01XXXXXXXXX)"),
  district: z.string().refine((d) => (BD_DISTRICTS as readonly string[]).includes(d), "Select a district"),
  area: z.string().trim().min(2, "Enter your area / thana").max(80),
  line: z.string().trim().min(5, "Enter your full address").max(250),
  zone: z.enum(["inside_dhaka", "outside_dhaka"]),
  is_default: z.boolean().default(false),
});

export type AddressInput = z.input<typeof addressSchema>;
type AddressResult = { error?: string; field?: string };

export async function saveAddress(input: AddressInput): Promise<AddressResult> {
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.message, field: issue.path.join(".") };
  }
  const { supabase, user } = await getSessionProfile();
  if (!user) return { error: "Please log in again" };
  const { id, ...a } = parsed.data;
  const row = { ...a, phone: normalizePhone(a.phone) };

  const { count } = await supabase.from("addresses").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if (!id && (count ?? 0) >= MAX_ADDRESSES) return { error: `You can save up to ${MAX_ADDRESSES} addresses` };
  // The first address is always the default one.
  const makeDefault = row.is_default || (!id && !count);
  if (makeDefault) await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);

  const { error } = id
    ? await supabase.from("addresses").update({ ...row, is_default: makeDefault }).eq("id", id).eq("user_id", user.id)
    : await supabase.from("addresses").insert({ ...row, is_default: makeDefault, user_id: user.id });
  if (error) return { error: "Couldn't save the address. Please try again." };
  revalidatePath("/account/addresses");
  return {};
}

export async function deleteAddress(id: string): Promise<AddressResult> {
  if (!z.uuid().safeParse(id).success) return { error: "Invalid address" };
  const { supabase, user } = await getSessionProfile();
  if (!user) return { error: "Please log in again" };
  const { error } = await supabase.from("addresses").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: "Couldn't delete the address. Please try again." };
  // Keep one default if any addresses remain.
  const { data: rest } = await supabase
    .from("addresses")
    .select("id, is_default")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (rest?.length && !rest.some((r) => r.is_default)) {
    await supabase.from("addresses").update({ is_default: true }).eq("id", rest[0].id);
  }
  revalidatePath("/account/addresses");
  return {};
}

export async function setDefaultAddress(id: string): Promise<AddressResult> {
  if (!z.uuid().safeParse(id).success) return { error: "Invalid address" };
  const { supabase, user } = await getSessionProfile();
  if (!user) return { error: "Please log in again" };
  await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
  const { error } = await supabase.from("addresses").update({ is_default: true }).eq("id", id).eq("user_id", user.id);
  if (error) return { error: "Couldn't update the address. Please try again." };
  revalidatePath("/account/addresses");
  return {};
}
