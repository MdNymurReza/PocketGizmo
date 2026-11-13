"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/server";

type Result = { error?: string };
const fail = (e: unknown): Result => ({ error: e instanceof Error ? e.message : String(e) });

function refresh(slug?: string | null) {
  revalidatePath("/admin/reviews");
  revalidatePath("/admin");
  if (slug) revalidatePath(`/product/${slug}`);
}

export async function setReviewStatus(id: string, status: "approved" | "rejected" | "pending"): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    if (!z.uuid().safeParse(id).success) return { error: "Invalid review" };
    const { data, error } = await supabase.from("reviews").update({ status }).eq("id", id).select("products(slug)").single();
    if (error) return { error: error.message };
    refresh(data.products?.slug);
    return {};
  } catch (e) {
    return fail(e);
  }
}

export async function deleteReview(id: string): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    if (!z.uuid().safeParse(id).success) return { error: "Invalid review" };
    const { data, error } = await supabase.from("reviews").delete().eq("id", id).select("products(slug)").single();
    if (error) return { error: error.message };
    refresh(data.products?.slug);
    return {};
  } catch (e) {
    return fail(e);
  }
}
