import { getSessionProfile } from "@/lib/supabase/server";
import { PageTitle } from "@/components/ui";
import { PrintJobsView, parseJobTab } from "@/components/print-jobs-view";

export default async function SupplierPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await getSessionProfile();
  // Row-level security limits this table to the supplier and the admin.
  const { data: jobs } = await supabase.from("print_jobs").select("*").order("created_at", { ascending: false }).limit(1000);

  return (
    <>
      <PageTitle>Print jobs</PageTitle>
      <p className="-mt-3 mb-6 max-w-2xl text-sm text-ink-soft">
        Everything the store needs printed. Update each job as you work, and enter your cost per piece so the totals stay right.
      </p>
      <PrintJobsView jobs={jobs ?? []} tab={parseJobTab(sp.tab)} basePath="/supplier" mode="supplier" />
    </>
  );
}
