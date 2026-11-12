import type { Metadata } from "next";
import Link from "next/link";
import { Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, PageTitle } from "@/components/ui";
import { CUSTOM_STATUS_COLOR, CUSTOM_STATUS_LABEL } from "@/lib/custom";
import { cn, formatBDT, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Custom requests" };

const TABS = [
  { key: "", label: "All" },
  { key: "new", label: "New" },
  { key: "quoted", label: "Quoted" },
  { key: "accepted", label: "Accepted" },
  { key: "done", label: "Completed" },
  { key: "rejected", label: "Declined" },
] as const;

export default async function CustomRequestsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "" } = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("custom_requests")
    .select("id, name, phone, description, files, quantity, status, quoted_price, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (tab) query = query.eq("status", tab as "new");
  const [{ data: requests }, { count: newCount }] = await Promise.all([
    query,
    supabase.from("custom_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);

  return (
    <>
      <PageTitle>Custom requests</PageTitle>
      <nav className="mb-4 flex flex-wrap gap-1" aria-label="Filter requests">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key ? `/admin/custom-requests?tab=${t.key}` : "/admin/custom-requests"}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.key ? "bg-white text-ink shadow-xs ring-1 ring-line" : "text-ink-soft hover:text-ink",
            )}
          >
            {t.label}
            {t.key === "new" && !!newCount && <Badge color="warning">{newCount}</Badge>}
          </Link>
        ))}
      </nav>

      <Card className="p-0">
        {requests?.length ? (
          <ul className="divide-y divide-line">
            {requests.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/custom-requests/${r.id}`} className="flex flex-wrap items-start gap-x-6 gap-y-2 px-5 py-4 hover:bg-surface">
                  <div className="min-w-0 flex-1 basis-80">
                    <p className="text-sm font-medium">
                      {r.name} <span className="font-normal text-ink-soft">· {r.phone}</span>
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">{r.description}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-ink-soft">
                    {r.files.length > 0 && (
                      <span className="inline-flex items-center gap-1"><Paperclip className="size-3.5" /> {r.files.length}</span>
                    )}
                    <span>Qty {r.quantity}</span>
                    {r.quoted_price != null && <span className="font-medium text-ink">{formatBDT(r.quoted_price)}</span>}
                    <Badge color={CUSTOM_STATUS_COLOR[r.status]}>{CUSTOM_STATUS_LABEL[r.status]}</Badge>
                    <span className="w-28 text-right text-xs">{formatDate(r.created_at).split(",")[0]}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-8 text-center text-ink-soft">No custom requests yet.</p>
        )}
      </Card>
    </>
  );
}
