"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Runs a server action: shows the error or a success message, then refreshes the page data.
 * `ok` can be a function when the message depends on the result.
 */
export function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = <R extends { error?: string }>(fn: () => Promise<R>, ok: string | ((res: R) => string), after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.error) return void toast.error(res.error);
      toast.success(typeof ok === "function" ? ok(res) : ok);
      after?.();
      router.refresh();
    });
  return { pending, run };
}
