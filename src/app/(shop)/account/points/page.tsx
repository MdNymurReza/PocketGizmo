import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Coins, Gift, Star } from "lucide-react";
import { getSessionProfile } from "@/lib/supabase/server";
import { ButtonLink, Card, EmptyState } from "@/components/ui";
import { formatBDT, formatDay } from "@/lib/utils";

export const metadata: Metadata = { title: "Points" };

const REASON: Record<string, string> = {
  earn: "Earned on order",
  earn_reversed: "Order cancelled",
  redeem: "Used on order",
  redeem_refund: "Returned from cancelled order",
  review: "Review approved",
  adjust: "Adjusted by the shop",
};

export default async function PointsPage() {
  const { supabase, user } = await getSessionProfile();
  if (!user) redirect("/login?next=/account/points");

  const [{ data: balance }, { data: rows }, { data: s }] = await Promise.all([
    supabase.rpc("points_balance", { p_user: user.id }),
    supabase.from("points_ledger").select("id, delta, reason, note, created_at, orders(order_number)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
    supabase.from("settings").select("points_enabled, points_spend_per_point, points_review, points_max_pct").eq("id", 1).single(),
  ]);
  const points = Number(balance ?? 0);
  const per = Number(s?.points_spend_per_point ?? 100);

  return (
    <div>
      <h1 className="text-2xl font-semibold sm:text-3xl">Points</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_1.4fr]">
        <Card className="bg-accent/5 ring-accent/20">
          <p className="flex items-center gap-2 text-sm font-medium text-ink-soft"><Coins className="size-4 text-accent" /> Your balance</p>
          <p className="mt-2 text-4xl font-semibold tabular-nums">{points.toLocaleString("en-US")}</p>
          <p className="mt-1 text-sm text-ink-soft">Worth {formatBDT(points)} off your next order</p>
          {points > 0 && s?.points_enabled && (
            <ButtonLink href="/shop" size="sm" className="mt-4">Use them</ButtonLink>
          )}
        </Card>
        <Card className="text-sm">
          <h2 className="font-semibold">How points work</h2>
          {s?.points_enabled ? (
            <ul className="mt-3 grid gap-2 text-ink-soft">
              <li className="flex gap-2"><Gift className="mt-0.5 size-4 shrink-0 text-accent" /> 1 point for every {formatBDT(per)} you spend, added when your order is delivered.</li>
              {Number(s.points_review) > 0 && (
                <li className="flex gap-2"><Star className="mt-0.5 size-4 shrink-0 text-accent" /> {s.points_review} points when your review is approved.</li>
              )}
              <li className="flex gap-2"><Coins className="mt-0.5 size-4 shrink-0 text-accent" /> 1 point = ৳1 off. Use them at checkout for up to {s.points_max_pct}% of an order.</li>
            </ul>
          ) : (
            <p className="mt-3 text-ink-soft">Points are paused right now. Your balance is safe.</p>
          )}
        </Card>
      </div>

      <h2 className="mt-10 font-semibold">History</h2>
      {rows?.length ? (
        <Card className="mt-3 p-0">
          <ul className="divide-y divide-line text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{REASON[r.reason] ?? r.reason}</p>
                  <p className="text-xs text-ink-soft">
                    {formatDay(r.created_at)}
                    {r.orders?.order_number && (
                      <>
                        {" · "}
                        <Link href={`/account/orders/${r.orders.order_number}`} className="hover:text-ink hover:underline">{r.orders.order_number}</Link>
                      </>
                    )}
                    {r.note && ` · ${r.note}`}
                  </p>
                </div>
                <span className={`font-semibold tabular-nums ${r.delta > 0 ? "text-success" : "text-ink-soft"}`}>
                  {r.delta > 0 ? "+" : ""}{r.delta}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState icon={Coins} title="No points yet" text="Place an order while signed in and you'll earn points when it's delivered." className="mt-3 rounded-xl border border-dashed border-line" />
      )}
    </div>
  );
}
