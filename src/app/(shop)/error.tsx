"use client";

import { ErrorView } from "@/components/error-view";

export default function ShopError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView {...props} />;
}
