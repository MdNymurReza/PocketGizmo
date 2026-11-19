import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/ui";
import { DealManager } from "@/components/admin/deal-manager";
import { DEAL_SELECT, type Deal } from "@/lib/deals";

export const metadata: Metadata = { title: "Deals" };

export default async function DealsPage() {
  const supabase = await createClient();
  const [{ data: deals }, { data: categories }, { data: products }] = await Promise.all([
    supabase.from("deals").select(DEAL_SELECT).order("created_at", { ascending: false }),
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("products").select("id, name, is_active").order("name"),
  ]);
  return (
    <>
      <PageTitle>Deals &amp; bundles</PageTitle>
      <DealManager deals={(deals ?? []) as Deal[]} categories={categories ?? []} products={products ?? []} />
    </>
  );
}
