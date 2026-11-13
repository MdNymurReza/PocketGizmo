import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/ui";
import { PrintJobsView, parseJobTab } from "@/components/print-jobs-view";
import { AddJobForm, PayAllButton, SupplierAccess } from "@/components/admin/supplier-tools";
import { jobTotal, summarize } from "@/lib/print-jobs";
import { variantLabel } from "@/lib/utils";

export const metadata: Metadata = { title: "Supplier" };

export default async function AdminSupplierPage({ searchParams }: { searchParams: Promise<{ tab?: string; product?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: jobRows }, { data: suppliers }, { data: productRows }] = await Promise.all([
    supabase.from("print_jobs").select("*").order("created_at", { ascending: false }).limit(1000),
    supabase.rpc("admin_list_suppliers"),
    supabase.from("products").select("id, name, product_variants(id, options, is_active)").order("name"),
  ]);
  const products = (productRows ?? [])
    .map((p) => ({
      id: p.id,
      name: p.name,
      variants: p.product_variants.filter((v) => v.is_active).map((v) => ({ id: v.id, label: variantLabel(v.options as Record<string, string>) })),
    }))
    .filter((p) => p.variants.length > 0);
  const jobs = jobRows ?? [];
  const { payable } = summarize(jobs);

  return (
    <>
      <PageTitle action={<AddJobForm key={sp.product ?? ""} products={products} initialProductId={sp.product} />}>Supplier</PageTitle>
      <p className="-mt-3 mb-6 max-w-2xl text-sm text-ink-soft">
        The print list you share with your supplier. Each item of an order is added here when you confirm the order, or when you click “Send to print” on an order. Use “Add a job” to print a product for stock. The supplier updates the status and
        cost; you mark what you have received and paid.
      </p>
      <PrintJobsView
        jobs={jobs}
        tab={parseJobTab(sp.tab)}
        basePath="/admin/supplier"
        mode="admin"
        toolbar={<PayAllButton ids={payable.map((j) => j.id)} total={payable.reduce((n, j) => n + jobTotal(j), 0)} />}
      />
      <SupplierAccess suppliers={suppliers ?? []} />
    </>
  );
}
