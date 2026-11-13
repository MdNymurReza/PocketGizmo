import { getSessionProfile } from "@/lib/supabase/server";
import { PageTitle } from "@/components/ui";
import { PrintJobsView } from "@/components/print-jobs-view";
import { loadPrintJobs, parseJobTab } from "@/lib/print-jobs";

export default async function SupplierPage({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string; q?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await getSessionProfile();
  const tab = parseJobTab(sp.tab);
  const list = await loadPrintJobs(supabase, tab, sp.page, sp.q);

  return (
    <>
      <PageTitle>Print jobs</PageTitle>
      <p className="-mt-3 mb-6 max-w-2xl text-sm text-ink-soft">
        Everything the store needs printed. Update each job as you work, and enter your cost per piece so the totals stay right.
      </p>
      <PrintJobsView {...list} tab={tab} basePath="/supplier" mode="supplier" />
    </>
  );
}
