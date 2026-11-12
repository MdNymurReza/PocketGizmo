import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download, FileBox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card } from "@/components/ui";
import { CustomRequestEditor } from "@/components/admin/custom-request-editor";
import { CUSTOM_STATUS_COLOR, CUSTOM_STATUS_LABEL, fileName } from "@/lib/custom";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Custom request" };

export default async function CustomRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: r } = await supabase.from("custom_requests").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();

  // Private bucket: generate short-lived download links (admins only, enforced by storage policy).
  const { data: signed } = r.files.length
    ? await supabase.storage.from("custom-uploads").createSignedUrls(r.files, 60 * 60, { download: true })
    : { data: [] };

  return (
    <>
      <Link href="/admin/custom-requests" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ChevronLeft className="size-4" /> Custom requests
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Request from {r.name}</h1>
        <Badge color={CUSTOM_STATUS_COLOR[r.status]}>{CUSTOM_STATUS_LABEL[r.status]}</Badge>
        <span className="text-sm text-ink-soft">{formatDate(r.created_at)}</span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="grid h-fit gap-6">
          <Card>
            <h2 className="font-semibold">Description</h2>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{r.description}</p>
            <dl className="mt-5 grid gap-4 border-t border-line pt-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-ink-soft">Material</dt>
                <dd className="font-medium">{r.material ?? "–"}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">Color</dt>
                <dd className="font-medium">{r.color ?? "–"}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">Quantity</dt>
                <dd className="font-medium">{r.quantity}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-0">
            <h2 className="border-b border-line px-5 py-3 font-semibold">Files ({r.files.length})</h2>
            {r.files.length ? (
              <ul className="divide-y divide-line">
                {r.files.map((f, i) => (
                  <li key={f} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <FileBox className="size-4 text-ink-soft" />
                    <span className="min-w-0 flex-1 truncate">{fileName(f).replace(/^\d+-/, "")}</span>
                    {signed?.[i]?.signedUrl ? (
                      <a href={signed[i].signedUrl} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                        <Download className="size-4" /> Download
                      </a>
                    ) : (
                      <span className="text-ink-soft">Unavailable</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-ink-soft">No files attached.</p>
            )}
          </Card>

          <CustomRequestEditor
            request={{ id: r.id, status: r.status, quoted_price: r.quoted_price?.toString() ?? "", admin_note: r.admin_note ?? "" }}
          />
        </div>

        <Card className="h-fit text-sm">
          <h2 className="font-semibold">Customer</h2>
          <p className="mt-2">{r.name}</p>
          <p>
            <a href={`tel:${r.phone}`} className="text-accent hover:underline">{r.phone}</a>
          </p>
          {r.email && (
            <p>
              <a href={`mailto:${r.email}`} className="text-accent hover:underline">{r.email}</a>
            </p>
          )}
          <p className="mt-1 text-xs text-ink-soft">
            {r.user_id ? "Registered customer: they can see and accept the quote in their account." : "Guest: contact them by phone to share the quote."}
          </p>
        </Card>
      </div>
    </>
  );
}
