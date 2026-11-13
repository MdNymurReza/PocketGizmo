import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums, Tables } from "@/lib/database.types";

export type PrintJob = Tables<"print_jobs">;
export type PrintJobStatus = Enums<"print_job_status">;

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
export async function loadPrintJobs(supabase: SupabaseClient<Database>, tab: JobTab, pageParam: string | undefined) {
  const { data: s } = await supabase.rpc("print_job_summary");
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

  const pages = Math.max(1, Math.ceil(summary.counts[tab] / JOBS_PER_PAGE));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(pageParam)) || 1));

  let q = supabase.from("print_jobs").select("*");
  if (tab === "todo") q = q.in("status", ["to_print", "printing"]);
  if (tab === "done" || tab === "unpaid") q = q.in("status", ["printed", "received"]);
  if (tab === "unpaid") q = q.eq("paid", false);
  if (tab === "paid") q = q.eq("paid", true);
  const { data: jobs } = await q
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * JOBS_PER_PAGE, page * JOBS_PER_PAGE - 1);

  return { summary, jobs: jobs ?? [], page, pages };
}
