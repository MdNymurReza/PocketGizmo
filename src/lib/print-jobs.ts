import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums, Tables } from "@/lib/database.types";

export type PrintJob = Tables<"print_jobs">;
export type PrintJobStatus = Enums<"print_job_status">;
export type SupplierPayment = Tables<"supplier_payments">;

export const JOB_STATUS_LABEL: Record<PrintJobStatus, string> = {
  to_print: "To print",
  printing: "Printing",
  printed: "Printed",
  received: "Received",
  cancelled: "Cancelled",
};

export const JOB_STATUS_COLOR = {
  to_print: "warning",
  printing: "accent",
  printed: "info",
  received: "success",
  cancelled: "danger",
} as const;

export const JOB_TABS = [
  { key: "todo", label: "To do" },
  { key: "done", label: "Printed" },
  { key: "unpaid", label: "Unpaid" },
  { key: "paid", label: "Paid" },
  { key: "all", label: "All" },
] as const;
export type JobTab = (typeof JOB_TABS)[number]["key"];

export const parseJobTab = (v: string | undefined): JobTab => (JOB_TABS.some((t) => t.key === v) ? (v as JobTab) : "todo");

/** Money is kept to 2 decimals, like the database does. */
export const roundMoney = (n: number) => Math.round(n * 100) / 100;

export const jobTotal = (j: Pick<PrintJob, "unit_cost" | "quantity">) => roundMoney(Number(j.unit_cost ?? 0) * j.quantity);

/** Finished work: the supplier has printed it, whether or not the store has collected it yet. */
export const isDone = (status: PrintJobStatus) => status === "printed" || status === "received";

export const JOBS_PER_PAGE = 50;

/** Open jobs for the same product and option, added up. */
export type JobGroup = { title: string; variant: string | null; pieces: number; withDetails: number };

export type JobSummary = {
  toPrint: number;
  printing: number;
  printed: number;
  /** Cost of all finished work that has a cost. */
  earned: number;
  paid: number;
  /** Finished, unpaid work. This is also the total of the jobs that can be paid now. */
  due: number;
  /** Finished, unpaid jobs that have a cost. */
  payableCount: number;
  /** Finished jobs where the supplier has not entered a cost yet. */
  missingCost: number;
  counts: Record<JobTab, number>;
};

/**
 * Totals over every job (computed in the database) and one page of the jobs in a tab.
 * Row-level security limits print jobs to the supplier and the admin.
 */
export async function loadPrintJobs(supabase: SupabaseClient<Database>, tab: JobTab, pageParam: string | undefined, search = "") {
  const term = search.trim().replace(/[%_,()]/g, " ").trim();
  const [{ data: s }, { data: payments }, { data: openRows }] = await Promise.all([
    supabase.rpc("print_job_summary"),
    // The payment history is shown on the Paid tab.
    tab === "paid" ? supabase.from("supplier_payments").select("*").order("paid_at", { ascending: false }).limit(50) : Promise.resolve({ data: null }),
    // Open jobs, to show how many pieces of each product are waiting.
    tab === "todo" && !term
      ? supabase.from("print_jobs").select("title, variant, quantity, details").in("status", ["to_print", "printing"]).limit(1000)
      : Promise.resolve({ data: null }),
  ]);
  const groupMap = new Map<string, JobGroup>();
  for (const r of openRows ?? []) {
    const key = `${r.title}\n${r.variant ?? ""}`;
    const g = groupMap.get(key) ?? { title: r.title, variant: r.variant, pieces: 0, withDetails: 0 };
    g.pieces += r.quantity;
    if (r.details) g.withDetails += r.quantity;
    groupMap.set(key, g);
  }
  const groups = [...groupMap.values()].sort((a, b) => b.pieces - a.pieces);
  const n = (v: number | undefined) => Number(v ?? 0);
  const summary: JobSummary = {
    toPrint: n(s?.to_print),
    printing: n(s?.printing),
    printed: n(s?.printed),
    earned: n(s?.earned),
    paid: n(s?.paid),
    due: n(s?.due),
    payableCount: n(s?.payable_count),
    missingCost: n(s?.missing_cost),
    counts: { todo: n(s?.count_todo), done: n(s?.count_done), unpaid: n(s?.count_unpaid), paid: n(s?.count_paid), all: n(s?.count_all) },
  };

  // Without a search the tab count is known already, so a page number that is too high can be corrected.
  const knownPages = Math.max(1, Math.ceil(summary.counts[tab] / JOBS_PER_PAGE));
  const wanted = Math.max(1, Math.floor(Number(pageParam)) || 1);
  const page = term ? wanted : Math.min(knownPages, wanted);

  let q = supabase.from("print_jobs").select("*", { count: "exact" });
  if (term) q = q.or(`title.ilike.%${term}%,order_number.ilike.%${term}%,variant.ilike.%${term}%,details.ilike.%${term}%`);
  if (tab === "todo") q = q.in("status", ["to_print", "printing"]);
  if (tab === "done" || tab === "unpaid") q = q.in("status", ["printed", "received"]);
  if (tab === "unpaid") q = q.eq("paid", false);
  if (tab === "paid") q = q.eq("paid", true);
  const { data: jobs, count } = await q
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * JOBS_PER_PAGE, page * JOBS_PER_PAGE - 1);

  const pages = Math.max(1, Math.ceil((count ?? 0) / JOBS_PER_PAGE));
  return { summary, jobs: jobs ?? [], page, pages, groups, search: term, payments: payments ?? [] };
}
