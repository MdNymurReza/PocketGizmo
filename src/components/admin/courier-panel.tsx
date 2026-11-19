"use client";

import { ExternalLink, Loader2, RefreshCw, Truck } from "lucide-react";
import { bookSteadfast, refreshCourierStatus } from "@/app/admin/orders/actions";
import { Button, Card } from "@/components/ui";
import { useAction } from "@/lib/use-action";
import { formatBDT } from "@/lib/utils";

/** Book the parcel with Steadfast in one click, then follow it. */
export function CourierPanel({
  order,
  ready,
  trackingUrl,
}: {
  order: { id: string; status: string; courier: string | null; tracking_code: string | null; consignment_id: string | null; due: number };
  ready: boolean;
  trackingUrl: string | null;
}) {
  const { pending, run } = useAction();
  const booked = Boolean(order.consignment_id);
  const canBook = !booked && ["confirmed", "printing", "shipped"].includes(order.status);

  if (!booked && !canBook) return null;
  return (
    <Card className="text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Truck className="size-4 text-accent" /> Steadfast courier
        </h2>
        {booked && order.tracking_code && (
          <span className="font-mono text-xs text-ink-soft">
            {order.tracking_code} · ID {order.consignment_id}
          </span>
        )}
      </div>
      {!ready ? (
        <p className="mt-2 text-ink-soft">
          Add STEADFAST_API_KEY and STEADFAST_SECRET_KEY to the server environment to book parcels from here.
        </p>
      ) : booked ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() =>
              run(
                () => refreshCourierStatus(order.id),
                (r) => (r.delivered ? `Delivered. Order marked as delivered.` : `Steadfast: ${r.label}`),
              )
            }
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Check delivery status
          </Button>
          {trackingUrl && (
            <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 px-2 font-medium text-accent hover:underline">
              Tracking page <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      ) : (
        <>
          <p className="mt-2 text-ink-soft">
            Sends the name, phone and address to Steadfast, saves the tracking code and marks the order as shipped.
            The rider collects <span className="font-medium text-ink">{formatBDT(order.due)}</span>
            {order.due === 0 ? " (already paid)." : " cash on delivery."}
          </p>
          <Button
            className="mt-3"
            variant="accent"
            disabled={pending}
            onClick={() => run(() => bookSteadfast(order.id), (r) => `Booked with Steadfast. Tracking ${r.tracking}`)}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />} Book with Steadfast
          </Button>
        </>
      )}
    </Card>
  );
}
