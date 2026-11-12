"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/server";

const schema = z.object({
  id: z.uuid(),
  status: z.enum(["new", "quoted", "accepted", "rejected", "done"]),
  quoted_price: z.union([z.coerce.number().min(0), z.literal(""), z.null()]).optional(),
  admin_note: z.string().max(2000).optional(),
});

export async function updateCustomRequest(input: z.input<typeof schema>): Promise<{ error?: string }> {
  try {
    const { supabase } = await requireAdmin();
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { id, status, quoted_price, admin_note } = parsed.data;
    const price = quoted_price === "" || quoted_price == null ? null : Number(quoted_price);
    if (status === "quoted" && price == null) return { error: "Enter a quoted price before sending the quote" };
    const { error } = await supabase
      .from("custom_requests")
      .update({ status, quoted_price: price, admin_note: admin_note?.trim() || null })
      .eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/admin/custom-requests");
    revalidatePath(`/admin/custom-requests/${id}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
