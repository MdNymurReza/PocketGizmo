"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateCustomRequest } from "@/app/admin/custom-requests/actions";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { CUSTOM_STATUS_LABEL } from "@/lib/custom";
import type { Enums } from "@/lib/database.types";

type Status = Enums<"custom_request_status">;

export function CustomRequestEditor({
  request,
}: {
  request: { id: string; status: Status; quoted_price: string; admin_note: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [price, setPrice] = useState(request.quoted_price);
  const [note, setNote] = useState(request.admin_note);
  const [status, setStatus] = useState<Status>(request.status);

  const save = (nextStatus: Status, message: string) =>
    start(async () => {
      const res = await updateCustomRequest({ id: request.id, status: nextStatus, quoted_price: price, admin_note: note });
      if (res.error) return void toast.error(res.error);
      setStatus(nextStatus);
      toast.success(message);
      router.refresh();
    });

  return (
    <Card>
      <h2 className="font-semibold">Quote</h2>
      <p className="mt-1 text-sm text-ink-soft">The price and message are shown to the customer in their account.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-[200px_1fr]">
        <Field label="Price (৳)" hint="Total for all units">
          <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Message to customer">
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Printed in black PETG, ready in 3 days. Delivery charge applies." />
        </Field>
      </div>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-line pt-5">
        <Button disabled={pending} onClick={() => save("quoted", "Quote sent")}>
          {request.status === "quoted" ? "Update quote" : "Send quote"}
        </Button>
        <div className="flex items-end gap-2">
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as Status)} className="w-40">
              {(Object.keys(CUSTOM_STATUS_LABEL) as Status[]).map((s) => (
                <option key={s} value={s}>{CUSTOM_STATUS_LABEL[s]}</option>
              ))}
            </Select>
          </Field>
          <Button variant="secondary" disabled={pending || status === request.status} onClick={() => save(status, "Status updated")}>
            Save status
          </Button>
        </div>
      </div>
    </Card>
  );
}
