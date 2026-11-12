"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionProfile } from "@/lib/supabase/server";

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
  revalidatePath("/account");
  return { ok: true };
}
