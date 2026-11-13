"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionProfile } from "@/lib/supabase/server";

type Result = { error?: string };

const schema = z.object({
  id: z.uuid(),
  status: z.enum(["to_print", "printing", "printed", "received", "cancelled"]).optional(),
  unitCost: z.number().min(0, "Cost cannot be negative").max(1_000_000).optional(),
  /** Remove the cost. Wins over unitCost. */
  clearCost: z.boolean().optional(),
  note: z.string().max(500).optional(),
});

/**
 * Update a print job's status, cost per piece or note. Used by the supplier and by the admin.
 * Only the fields that are given are changed. The database function decides what each role may change.
 */
export async function updateJob(input: z.input<typeof schema>): Promise<Result> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, profile } = await getSessionProfile();
  if (profile?.role !== "supplier" && profile?.role !== "admin") return { error: "Not authorized" };

  const { id, status, unitCost, clearCost, note } = parsed.data;
  const { error } = await supabase.rpc("supplier_update_job", {
    p_job: id,
    p_status: status ?? null,
    p_unit_cost: clearCost ? null : (unitCost ?? null),
    p_note: note ?? null,
    p_clear_cost: Boolean(clearCost),
  });
  if (error) {
    const known = /closed|already paid|not paid|cannot|not found|negative/i;
    return { error: known.test(error.message) ? error.message : "Couldn't save that. Please try again." };
  }
  revalidatePath("/supplier");
  revalidatePath("/admin/supplier");
  return {};
}
