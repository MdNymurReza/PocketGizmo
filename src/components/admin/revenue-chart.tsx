"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBDT } from "@/lib/utils";

type Point = { day: string; revenue: number; orders: number };

const short = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const compact = (n: number) => (n >= 1000 ? `৳${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `৳${n}`);

/** Single-series daily revenue. Days without orders are filled with zero so gaps are honest. */
export function RevenueChart({ data, from, to }: { data: Point[]; from: string; to: string }) {
  const byDay = new Map(data.map((d) => [d.day, d]));
  const days: Point[] = [];
  const end = new Date(to + "T00:00:00");
  for (let d = new Date(from + "T00:00:00"); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toLocaleDateString("en-CA");
    days.push(byDay.get(key) ?? { day: key, revenue: 0, orders: 0 });
  }

  return (
    <div className="h-64 w-full" role="img" aria-label="Daily revenue chart">
      <ResponsiveContainer>
        <BarChart data={days} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={days.length > 40 ? 1 : "20%"}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis
            dataKey="day"
            tickFormatter={short}
            tick={{ fontSize: 12, fill: "var(--ink-soft)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--line)" }}
            minTickGap={24}
          />
          <YAxis tickFormatter={compact} tick={{ fontSize: 12, fill: "var(--ink-soft)" }} tickLine={false} axisLine={false} width={52} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "var(--surface)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as Point;
              return (
                <div className="rounded-lg border border-line bg-white px-3 py-2 text-sm shadow-md">
                  <p className="text-xs text-ink-soft">{short(p.day)}</p>
                  <p className="font-semibold tabular-nums">{formatBDT(p.revenue)}</p>
                  <p className="text-xs text-ink-soft">{p.orders} order{p.orders === 1 ? "" : "s"}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="revenue" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
