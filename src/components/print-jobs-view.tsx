import Link from "next/link";
import { Printer, Search } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, Input } from "@/components/ui";
import { PrintJobCard } from "@/components/print-job-card";
import { JOB_TABS, type JobGroup, type JobSummary, type JobTab, type PrintJob, type SupplierPayment } from "@/lib/print-jobs";
import { cn, formatBDT, formatDate } from "@/lib/utils";

const EMPTY: Record<JobTab, { title: string; supplier: string; admin: string }> = {
  todo: {
    title: "Nothing to print right now",
    supplier: "New jobs appear here when the store confirms an order.",
    admin: "Jobs are added here automatically when you confirm an order.",
  },
  done: { title: "No printed jobs yet", supplier: "Jobs you mark as printed are listed here.", admin: "Jobs the supplier has printed are listed here." },
  unpaid: { title: "Nothing waiting for payment", supplier: "Printed jobs that are not paid yet are listed here.", admin: "Printed jobs you have not paid for are listed here." },
  paid: { title: "No paid jobs yet", supplier: "Jobs the store has paid for are listed here.", admin: "Jobs you have marked as paid are listed here." },
  all: { title: "No print jobs yet", supplier: "New jobs appear here when the store confirms an order.", admin: "Jobs are added here automatically when you confirm an order." },
};

/** Totals, tabs and the job list. Shared by the supplier dashboard and the admin's supplier page. */
export function PrintJobsView({
  summary: s,
  jobs,
  page,
  pages,
  groups,
  search,
  payments,
  tab,
  basePath,
  mode,
  toolbar,
}: {
  /** Totals over every job, not only the ones on this page. */
  summary: JobSummary;
  /** The jobs of this tab on this page. */
  jobs: PrintJob[];
  page: number;
  pages: number;
  /** Open jobs added up per product. Only loaded for the To do tab. */
  groups: JobGroup[];
  /** The text the list is filtered by, if any. */
  search: string;
  /** Recorded payments, newest first. Only loaded for the Paid tab. */
  payments: SupplierPayment[];
  tab: JobTab;
  basePath: string;
  mode: "supplier" | "admin";
  /** Extra controls shown to the right of the tabs. */
  toolbar?: React.ReactNode;
}) {
  const isAdmin = mode === "admin";
  const href = (t: JobTab, p = 1) => {
    const q = new URLSearchParams();
    if (t !== "todo") q.set("tab", t);
    if (search) q.set("q", search);
    if (p > 1) q.set("page", String(p));
    return q.size ? `${basePath}?${q}` : basePath;
  };
  const pageHref = (p: number) => href(tab, p);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Tile label="To print" value={`${s.toPrint} pcs`} />
        <Tile label="Printing now" value={`${s.printing} pcs`} />
        <Tile label={isAdmin ? "Printed, to collect" : "Printed, to hand over"} value={`${s.printed} pcs`} />
        <Tile label="Finished work" value={formatBDT(s.earned)} />
        <Tile label="Paid" value={formatBDT(s.paid)} />
        <Tile label={isAdmin ? "You owe" : "You are owed"} value={formatBDT(s.due)} strong />
      </div>

      {s.missingCost > 0 && (
        <p className="mt-4 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
          {s.missingCost} printed job{s.missingCost === 1 ? " has" : "s have"} no cost yet, so {s.missingCost === 1 ? "it is" : "they are"} not counted in the totals.{" "}
          {isAdmin ? "Ask the supplier to add the cost, or enter it yourself." : "Add the cost per piece so the store knows what to pay."}
        </p>
      )}

      <div className="mt-6 mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-1" aria-label="Filter print jobs">
          {JOB_TABS.map((t) => (
            <Link
              key={t.key}
              href={href(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t.key ? "bg-white text-ink shadow-xs ring-1 ring-line" : "text-ink-soft hover:text-ink",
              )}
            >
              {t.label}
              {s.counts[t.key] > 0 && t.key !== "all" && <Badge color={t.key === "todo" ? "warning" : "neutral"}>{s.counts[t.key]}</Badge>}
            </Link>
          ))}
        </nav>
        <div className="flex w-full flex-wrap items-center justify-end gap-3 sm:w-auto">
          {toolbar}
          <form className="relative w-full sm:w-64">
            {tab !== "todo" && <input type="hidden" name="tab" value={tab} />}
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
            <Input name="q" defaultValue={search} placeholder="Product, order #, details" className="h-9 pl-9" aria-label="Search print jobs" />
          </form>
        </div>
      </div>

      {search && (
        <p className="mb-4 text-sm text-ink-soft">
          Showing jobs that match “{search}”.{" "}
          <Link href={tab === "todo" ? basePath : `${basePath}?tab=${tab}`} className="font-medium text-ink underline underline-offset-4">
            Show all
          </Link>
        </p>
      )}

      {groups.length > 1 && (
        <Card className="mb-4">
          <h2 className="font-semibold">Pieces waiting, by product</h2>
          <p className="mt-1 text-sm text-ink-soft">Added up over all open jobs, so the same product can be printed together.</p>
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {groups.map((g) => (
              <li key={`${g.title}:${g.variant}`} className="rounded-lg border border-line bg-surface px-3 py-2">
                <span className="font-semibold tabular-nums">{g.pieces} ×</span> {g.title}
                {g.variant && <span className="text-ink-soft"> · {g.variant}</span>}
                {g.withDetails > 0 && <span className="ml-1.5 rounded bg-warning/10 px-1.5 py-0.5 text-xs font-medium">{g.withDetails} with custom details</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === "paid" && payments.length > 0 && !search && (
        <Card className="mb-4 overflow-x-auto p-0">
          <h2 className="border-b border-line px-5 py-3 font-semibold">Payment history</h2>
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-surface text-xs text-ink-soft">
              <tr>
                <th className="px-5 py-2 font-medium">Date</th>
                <th className="px-5 py-2 font-medium">Jobs</th>
                <th className="px-5 py-2 font-medium">How</th>
                <th className="px-5 py-2 font-medium">Reference</th>
                <th className="px-5 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-2.5 whitespace-nowrap">{formatDate(p.paid_at)}</td>
                  <td className="px-5 py-2.5 tabular-nums">{p.job_count}</td>
                  <td className="px-5 py-2.5">{p.method ?? "–"}</td>
                  <td className="px-5 py-2.5 break-all">{p.reference ?? "–"}</td>
                  <td className="px-5 py-2.5 text-right font-medium tabular-nums">{formatBDT(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        {jobs.length ? (
          <ul className="divide-y divide-line">
            {jobs.map((j) => (
              <PrintJobCard key={`${j.id}:${j.updated_at}`} job={j} mode={mode} />
            ))}
          </ul>
        ) : (
          <EmptyState icon={Printer} title={search ? "No jobs match your search" : EMPTY[tab].title} text={search ? "Check the spelling, or look in the All tab." : EMPTY[tab][mode]} />
        )}
      </Card>

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between gap-3 text-sm" aria-label="Pages">
          {page > 1 ? (
            <ButtonLink href={pageHref(page - 1)} variant="secondary" size="sm">
              Newer
            </ButtonLink>
          ) : (
            <span />
          )}
          <span className="text-ink-soft">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <ButtonLink href={pageHref(page + 1)} variant="secondary" size="sm">
              Older
            </ButtonLink>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}

function Tile({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-4", strong ? "border-accent/30 bg-accent/5" : "border-line bg-white")}>
      <p className="text-xs font-medium text-ink-soft">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums", strong && "text-accent")}>{value}</p>
    </div>
  );
}
