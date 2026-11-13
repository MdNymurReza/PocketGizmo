import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui";
import { Stars } from "@/components/shop/stars";
import { ReviewActions } from "@/components/admin/review-actions";
import { ReviewPhotoList } from "@/components/shop/review-photos";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Reviews" };

const TABS = [
  { key: "pending", label: "To approve" },
  { key: "approved", label: "Published" },
  { key: "rejected", label: "Rejected" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const EMPTY: Record<Tab, { title: string; text: string }> = {
  pending: { title: "No reviews waiting", text: "New reviews from customers appear here for you to approve." },
  approved: { title: "No published reviews yet", text: "Reviews you approve are shown on the product page." },
  rejected: { title: "No rejected reviews", text: "Reviews you reject stay hidden from customers." },
};

export default async function AdminReviewsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "pending";
  const supabase = await createClient();

  const [{ data: reviews }, { count: pendingCount }] = await Promise.all([
    supabase
      .from("reviews")
      .select("id, author_name, rating, comment, photos, status, created_at, products(name, slug)")
      .eq("status", tab)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  return (
    <>
      <PageTitle>Reviews</PageTitle>
      <p className="-mt-3 mb-6 max-w-2xl text-sm text-ink-soft">
        Only customers whose order was delivered can review a product. A review is shown on the product page after you approve it.
      </p>

      <nav className="mb-4 flex flex-wrap gap-1" aria-label="Filter reviews">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "pending" ? "/admin/reviews" : `/admin/reviews?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.key ? "bg-white text-ink shadow-xs ring-1 ring-line" : "text-ink-soft hover:text-ink",
            )}
          >
            {t.label}
            {t.key === "pending" && !!pendingCount && <Badge color="warning">{pendingCount}</Badge>}
          </Link>
        ))}
      </nav>

      <Card className="max-w-4xl overflow-hidden p-0">
        {reviews?.length ? (
          <ul className="divide-y divide-line">
            {reviews.map((r) => (
              <li key={r.id} className="grid gap-3 px-5 py-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stars rating={r.rating} />
                    <span className="font-medium">{r.author_name}</span>
                    <span className="text-xs text-ink-soft">{formatDate(r.created_at)}</span>
                  </div>
                  {r.products && (
                    <Link href={`/product/${r.products.slug}#reviews`} target="_blank" className="text-ink-soft underline-offset-4 hover:text-ink hover:underline">
                      {r.products.name}
                    </Link>
                  )}
                </div>
                {r.comment ? (
                  <p className="leading-relaxed whitespace-pre-line">{r.comment}</p>
                ) : (
                  <p className="text-ink-soft italic">Rating only, no comment.</p>
                )}
                <ReviewPhotoList photos={r.photos} author={r.author_name} />
                <ReviewActions id={r.id} status={r.status} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Star} title={EMPTY[tab].title} text={EMPTY[tab].text} />
        )}
      </Card>
    </>
  );
}
