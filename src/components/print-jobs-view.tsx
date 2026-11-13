import Link from "next/link";
import { Printer } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState } from "@/components/ui";
import { PrintJobCard } from "@/components/print-job-card";
import { JOB_TABS, type JobSummary, type JobTab, type PrintJob } from "@/lib/print-jobs";
import { cn, formatBDT } from "@/lib/utils";

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
  tab: JobTab;
  basePath: string;
  mode: "supplier" | "admin";
  /** Extra controls shown to the right of the tabs. */
  toolbar?: React.ReactNode;
}) {
  const isAdmin = mode === "admin";
  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    if (tab !== "todo") q.set("tab", tab);
    if (p > 1) q.set("page", String(p));
    return q.size ? `${basePath}?${q}` : basePath;
  };

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
              href={t.key === "todo" ? basePath : `${basePath}?tab=${t.key}`}
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
        {toolbar}
      </div>

      <Card className="overflow-hidden p-0">
        {jobs.length ? (
          <ul className="divide-y divide-line">
            {jobs.map((j) => (
              <PrintJobCard key={`${j.id}:${j.updated_at}`} job={j} mode={mode} />
            ))}
          </ul>
        ) : (
          <EmptyState icon={Printer} title={EMPTY[tab].title} text={EMPTY[tab][mode]} />
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
