"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { sendOrderToPrint } from "@/app/admin/supplier/actions";
import { Badge, Button } from "@/components/ui";

/**
 * Puts an order's items on the supplier's print list.
 * Once the order is on the list, it shows a link to the list instead.
 */
export function SendToPrint({ orderId, sent, cancelled }: { orderId: string; sent: boolean; cancelled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

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
        start(async () => {
          const res = await sendOrderToPrint(orderId);
          if (res.error) return void toast.error(res.error);
          toast.success(res.count ? `Sent ${res.count} item${res.count === 1 ? "" : "s"} to print` : "Already on the print list");
          router.refresh();
        })
      }
    >
      <Printer className="size-4" /> Send to print
    </Button>
  );
}
