"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/server";

type Result = { error?: string };
const fail = (e: unknown): Result => ({ error: e instanceof Error ? e.message : String(e) });

function refresh() {
  revalidatePath("/admin/filaments");
  revalidatePath("/custom-order");
}

const filamentSchema = z.object({
  material: z.string().trim().min(1, "Enter a material, e.g. PLA").max(40),
  color: z.string().trim().min(1, "Enter a color name").max(40),
  hex: z.union([z.string().regex(/^#[0-9a-fA-F]{6}$/), z.literal("")]).transform((v) => v || null),
});

export async function addFilament(input: z.input<typeof filamentSchema>): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    const parsed = filamentSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { error } = await supabase.from("filaments").insert(parsed.data);
    if (error) return { error: error.code === "23505" ? "That material and color is already on the list" : error.message };
    refresh();
    return {};
  } catch (e) {
    return fail(e);
  }
}

export async function setFilamentStock(id: string, inStock: boolean): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    if (!z.uuid().safeParse(id).success) return { error: "Invalid filament" };
    const { error } = await supabase.from("filaments").update({ in_stock: inStock }).eq("id", id);
    if (error) return { error: error.message };
    refresh();
    return {};
  } catch (e) {
    return fail(e);
  }
}

export async function deleteFilament(id: string): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    if (!z.uuid().safeParse(id).success) return { error: "Invalid filament" };
    const { error } = await supabase.from("filaments").delete().eq("id", id);
    if (error) return { error: error.message };
    refresh();
    return {};
  } catch (e) {
    return fail(e);
  }
}

export async function setMaxPrintColors(value: number): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    const n = z.coerce.number().int().min(1, "Must be at least 1").max(16, "Must be 16 or less").safeParse(value);
    if (!n.success) return { error: n.error.issues[0].message };
    const { error } = await supabase.from("settings").update({ max_print_colors: n.data }).eq("id", 1);
    if (error) return { error: error.message };
    refresh();
    return {};
  } catch (e) {
    return fail(e);
  }
}
