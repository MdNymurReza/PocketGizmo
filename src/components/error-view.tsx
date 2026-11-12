"use client";

import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui";

/** Friendly fallback for unexpected errors, with a retry. */
export function ErrorView({ error, reset, homeHref = "/" }: { error: Error & { digest?: string }; reset: () => void; homeHref?: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto grid max-w-md place-items-center px-4 py-24 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-danger/10 text-danger">
        <TriangleAlert className="size-6" strokeWidth={1.75} />
      </span>
      <h1 className="mt-5 text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-ink-soft">
        We couldn&apos;t load this page. Check your connection and try again. If it keeps happening, please contact us.
      </p>
      {error.digest && <p className="mt-3 font-mono text-xs text-ink-soft">Reference: {error.digest}</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>
          <RefreshCw className="size-4" /> Try again
        </Button>
        <ButtonLink href={homeHref} variant="secondary">
          Go to homepage
        </ButtonLink>
      </div>
    </div>
  );
}
