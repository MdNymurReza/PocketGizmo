"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { respondToQuote } from "@/app/(shop)/custom-order/actions";
import { Badge, Button, Card } from "@/components/ui";
import { CUSTOM_STATUS_COLOR, CUSTOM_STATUS_LABEL } from "@/lib/custom";
import type { Enums } from "@/lib/database.types";
import { formatBDT, formatDate } from "@/lib/utils";

type Req = {
  id: string;
  description: string;
  status: Enums<"custom_request_status">;
  quoted_price: number | null;
  admin_note: string | null;
  quantity: number;
  created_at: string;
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
    <Card className="p-0">
      <h2 className="border-b border-line px-5 py-4 font-semibold">Custom print requests</h2>
      <ul className="divide-y divide-line">
        {requests.map((r) => (
          <li key={r.id} className="px-5 py-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 basis-64">
                <p className="line-clamp-2">{r.description}</p>
                <p className="mt-1 text-xs text-ink-soft">
                  {formatDate(r.created_at).split(",")[0]} · Qty {r.quantity}
                </p>
              </div>
              <Badge color={CUSTOM_STATUS_COLOR[r.status]}>{CUSTOM_STATUS_LABEL[r.status]}</Badge>
            </div>
            {r.quoted_price != null && r.status !== "new" && (
              <div className="mt-3 rounded-lg bg-surface p-4">
                <p>
                  Quote: <span className="text-base font-semibold">{formatBDT(r.quoted_price)}</span>
                </p>
                {r.admin_note && <p className="mt-1 text-ink-soft">{r.admin_note}</p>}
                {r.status === "quoted" && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" disabled={pending} onClick={() => respond(r.id, true)}>Accept quote</Button>
                    <Button size="sm" variant="secondary" disabled={pending} onClick={() => respond(r.id, false)}>Decline</Button>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
