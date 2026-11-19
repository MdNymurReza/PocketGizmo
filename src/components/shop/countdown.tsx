"use client";

import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

/** "Ends in 2d 04:13:09". Renders nothing once the time has passed. */
export function Countdown({ to, className }: { to: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return <span className={className}>&nbsp;</span>;
  const left = Math.max(0, Date.parse(to) - now);
  if (!left) return null;
  const s = Math.floor(left / 1000);
  const d = Math.floor(s / 86400);
  return (
    <span className={className} role="timer" aria-label={`Ends in ${d} days`}>
      Ends in {d > 0 && `${d}d `}
      <span className="tabular-nums">{pad(Math.floor((s % 86400) / 3600))}:{pad(Math.floor((s % 3600) / 60))}:{pad(s % 60)}</span>
    </span>
  );
}
