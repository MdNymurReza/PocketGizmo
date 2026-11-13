import type { Enums, Tables } from "@/lib/database.types";

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

export const jobTotal = (j: Pick<PrintJob, "unit_cost" | "quantity">) => Number(j.unit_cost ?? 0) * j.quantity;

/** Finished work: the supplier has printed it, whether or not the store has collected it yet. */
const isDone = (j: PrintJob) => j.status === "printed" || j.status === "received";

export function inTab(j: PrintJob, tab: JobTab) {
  if (tab === "todo") return j.status === "to_print" || j.status === "printing";
  if (tab === "done") return isDone(j);
  if (tab === "unpaid") return isDone(j) && !j.paid;
  if (tab === "paid") return j.paid;
  return true;
}

export function summarize(jobs: PrintJob[]) {
  const pieces = (s: PrintJobStatus) => jobs.filter((j) => j.status === s).reduce((n, j) => n + j.quantity, 0);
  const done = jobs.filter(isDone);
  const unpaid = done.filter((j) => !j.paid);
  return {
    toPrint: pieces("to_print"),
    printing: pieces("printing"),
    printed: pieces("printed"),
    received: pieces("received"),
    /** Cost of all finished work that has a cost. */
    earned: done.reduce((n, j) => n + jobTotal(j), 0),
    paid: jobs.filter((j) => j.paid).reduce((n, j) => n + jobTotal(j), 0),
    due: unpaid.reduce((n, j) => n + jobTotal(j), 0),
    /** Finished, unpaid jobs that can be paid now (they have a cost). */
    payable: unpaid.filter((j) => j.unit_cost != null),
    /** Finished jobs where the supplier has not entered a cost yet. */
    missingCost: done.filter((j) => j.unit_cost == null).length,
    counts: Object.fromEntries(JOB_TABS.map((t) => [t.key, jobs.filter((j) => inTab(j, t.key)).length])) as Record<JobTab, number>,
  };
}
