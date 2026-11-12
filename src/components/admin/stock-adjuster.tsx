"use client";

import { useState, useTransition } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { adjustStock } from "@/app/admin/actions";
import { Button, Input } from "@/components/ui";

export function StockAdjuster({ variantId }: { variantId: string }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  const apply = (sign: 1 | -1) => {
    const n = Math.abs(Number(amount));
    if (!Number.isInteger(n) || n === 0) return void toast.error("Enter a whole number");
    start(async () => {
      const res = await adjustStock({
        variantId,
        delta: sign * n,
        reason: sign > 0 ? "restock" : "adjust",
        note,
      });
      if (res.error) return void toast.error(res.error);
      toast.success(`Stock is now ${res.stock}`);
      setAmount("");
      setNote("");
    });
  };

  return (
    <div className="flex items-center gap-1.5">
      <Input className="h-9 w-16" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Quantity" placeholder="Qty" />
      <Input className="h-9 w-32" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" placeholder="Note (optional)" />
      <Button size="icon" variant="secondary" className="size-9" onClick={() => apply(1)} disabled={pending} aria-label="Add stock">
        <Plus className="size-4" />
      </Button>
      <Button size="icon" variant="secondary" className="size-9" onClick={() => apply(-1)} disabled={pending} aria-label="Remove stock">
        <Minus className="size-4" />
      </Button>
    </div>
  );
}
