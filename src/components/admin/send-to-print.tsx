"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { sendOrderToPrint } from "@/app/admin/supplier/actions";
import { Badge, Button } from "@/components/ui";
import { useAction } from "@/lib/use-action";

/**
 * Puts an order's items on the supplier's print list.
 * Once the order is on the list, it shows a link to the list instead.
 */
export function SendToPrint({ orderId, sent, cancelled }: { orderId: string; sent: boolean; cancelled?: boolean }) {
  const { pending, run } = useAction();

  if (sent) {
    return (
      <Link href="/admin/supplier?tab=all" title="Open the print list">
        <Badge color="accent">
          <Printer className="size-3" /> On print list
        </Badge>
      </Link>
    );
  }
  if (cancelled) return null;

  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() =>
        run(
          () => sendOrderToPrint(orderId),
          (r) => (r.count ? `Sent ${r.count} item${r.count === 1 ? "" : "s"} to print` : "Already on the print list"),
        )
      }
    >
      <Printer className="size-4" /> Send to print
    </Button>
  );
}
