"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { respondToQuote } from "@/app/(shop)/custom-order/actions";
import { Badge, Button, Card } from "@/components/ui";
import { CUSTOM_STATUS_COLOR, CUSTOM_STATUS_LABEL } from "@/lib/custom";
import type { Enums } from "@/lib/database.types";
import { formatBDT, formatDay } from "@/lib/utils";

type Req = {
  id: string;
  description: string;
  status: Enums<"custom_request_status">;
  quoted_price: number | null;
  admin_note: string | null;
  quantity: number;
  material?: string | null;
  color?: string | null;
  created_at: string;
};

/** What happens next, in plain words, for each stage of a request. */
const NEXT_STEP: Record<Req["status"], string> = {
  new: "We're reviewing your request and will send a quote soon.",
  quoted: "Your quote is ready. Accept it to go ahead, or decline.",
  accepted: "Quote accepted. We'll contact you to arrange payment and delivery.",
  rejected: "You declined this quote.",
  done: "This request is complete.",
};

export function MyCustomRequests({ requests }: { requests: Req[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const respond = (id: string, accept: boolean) =>
    start(async () => {
      const res = await respondToQuote(id, accept);
      if (res.error) return void toast.error(res.error);
      toast.success(accept ? "Quote accepted. We'll be in touch to arrange payment and delivery." : "Quote declined");
      router.refresh();
    });

  return (
    <ul className="grid gap-4">
      {requests.map((r) => (
        <li key={r.id}>
          <Card className={r.status === "quoted" ? "border-accent/40 text-sm" : "text-sm"}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="text-xs text-ink-soft">
                {formatDay(r.created_at)} · Qty {r.quantity}
                {r.material && ` · ${r.material}`}
                {r.color && ` · ${r.color}`}
              </p>
              <Badge color={CUSTOM_STATUS_COLOR[r.status]}>{CUSTOM_STATUS_LABEL[r.status]}</Badge>
            </div>
            <p className="mt-2 line-clamp-3 whitespace-pre-line">{r.description}</p>

            {r.quoted_price != null && r.status !== "new" ? (
              <div className="mt-4 rounded-lg bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-ink-soft">Our quote</p>
                  <p className="text-xl font-semibold tabular-nums">{formatBDT(r.quoted_price)}</p>
                </div>
                {r.admin_note && <p className="mt-2 whitespace-pre-line text-ink-soft">{r.admin_note}</p>}
                {r.status === "quoted" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" disabled={pending} onClick={() => respond(r.id, true)}>
                      Accept quote
                    </Button>
                    <Button size="sm" variant="secondary" disabled={pending} onClick={() => respond(r.id, false)}>
                      Decline
                    </Button>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-ink-soft">{NEXT_STEP[r.status]}</p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-xs text-ink-soft">{NEXT_STEP[r.status]}</p>
            )}
          </Card>
        </li>
      ))}
    </ul>
  );
}
