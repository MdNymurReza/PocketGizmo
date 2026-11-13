import Link from "next/link";
import { BadgeCheck, MessageSquare } from "lucide-react";
import { getSessionProfile } from "@/lib/supabase/server";
import { Stars } from "./stars";
import { ReviewForm } from "./review-form";
import { ReviewPhotoList } from "./review-photos";
import { formatDay } from "@/lib/utils";

export type ReviewSummary = { count: number; average: number };

type Review = { id: string; author_name: string; rating: number; comment: string; photos: string[]; created_at: string };

const FIRST = 6;

/** Customer reviews for a product: summary, the list, and the form for eligible buyers. */
export async function ReviewsSection({ productId, slug, reviews }: { productId: string; slug: string; reviews: Review[] }) {
  const { supabase, user } = await getSessionProfile();

  const [{ data: mine }, { data: eligible }] = user
    ? await Promise.all([
        supabase.from("reviews").select("rating, comment, photos, status").eq("product_id", productId).eq("user_id", user.id).maybeSingle(),
        supabase.rpc("can_review", { p_product: productId }),
      ])
    : [{ data: null }, { data: false }];

  const count = reviews.length;
  const average = count ? reviews.reduce((n, r) => n + r.rating, 0) / count : 0;
  const dist = [5, 4, 3, 2, 1].map((stars) => ({ stars, n: reviews.filter((r) => r.rating === stars).length }));

  return (
    <section id="reviews" aria-labelledby="reviews-heading" className="mt-24 scroll-mt-28">
      <h2 id="reviews-heading" className="text-2xl font-semibold">
        Customer reviews
      </h2>

      <div className="mt-8 grid gap-10 lg:grid-cols-[320px_1fr] lg:gap-16">
        <div className="grid h-fit gap-6">
          {count > 0 ? (
            <div>
              <div className="flex items-end gap-3">
                <p className="text-5xl font-semibold tabular-nums">{average.toFixed(1)}</p>
                <div className="pb-1">
                  <Stars rating={average} size="size-5" />
                  <p className="mt-1 text-sm text-ink-soft">
                    Based on {count} review{count === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <ul className="mt-5 grid gap-1.5" aria-label="Rating breakdown">
                {dist.map(({ stars, n }) => (
                  <li key={stars} className="flex items-center gap-3 text-sm">
                    <span className="w-12 shrink-0 text-ink-soft">
                      {stars} star{stars === 1 ? "" : "s"}
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                      <span className="block h-full rounded-full bg-amber-400" style={{ width: `${(n / count) * 100}%` }} />
                    </span>
                    <span className="w-6 shrink-0 text-right text-ink-soft tabular-nums">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-ink-soft">No reviews yet. Be the first to share what you think.</p>
          )}

          {/* Who can write a review */}
          {!user ? (
            <p className="rounded-xl bg-surface p-4 text-sm text-ink-soft">
              Bought this?{" "}
              <Link href={`/login?next=/product/${slug}%23reviews`} className="font-medium text-ink underline underline-offset-4">
                Log in
              </Link>{" "}
              to write a review.
            </p>
          ) : eligible || mine ? (
            <ReviewForm productId={productId} slug={slug} userId={user.id} mine={mine} />
          ) : (
            <p className="rounded-xl bg-surface p-4 text-sm text-ink-soft">
              You can review this product once you&apos;ve ordered it and it has been delivered.
            </p>
          )}
        </div>

        <div>
          {count > 0 ? (
            <>
              <ul className="divide-y divide-line border-y border-line">
                {reviews.slice(0, FIRST).map((r) => (
                  <ReviewItem key={r.id} review={r} />
                ))}
              </ul>
              {count > FIRST && (
                <details className="group">
                  <summary className="mt-4 inline-flex cursor-pointer list-none items-center rounded-lg border border-line px-4 py-2 text-sm font-medium shadow-xs hover:bg-surface group-open:hidden">
                    Show {count - FIRST} more review{count - FIRST === 1 ? "" : "s"}
                  </summary>
                  <ul className="divide-y divide-line border-b border-line">
                    {reviews.slice(FIRST).map((r) => (
                      <ReviewItem key={r.id} review={r} />
                    ))}
                  </ul>
                </details>
              )}
            </>
          ) : (
            <div className="grid place-items-center rounded-xl border border-dashed border-line px-6 py-14 text-center">
              <MessageSquare className="size-6 text-ink-soft" strokeWidth={1.5} />
              <p className="mt-3 text-sm text-ink-soft">Reviews from customers who bought this will show up here.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ReviewItem({ review: r }: { review: Review }) {
  return (
    <li className="py-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <Stars rating={r.rating} />
        <time dateTime={r.created_at} className="text-xs text-ink-soft">
          {formatDay(r.created_at)}
        </time>
      </div>
      {r.comment && <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{r.comment}</p>}
      <ReviewPhotoList photos={r.photos} author={r.author_name} />
      <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm">
        <span className="font-medium">{r.author_name}</span>
        <span className="inline-flex items-center gap-1 text-xs text-success">
          <BadgeCheck className="size-3.5" /> Verified buyer
        </span>
      </p>
    </li>
  );
}
