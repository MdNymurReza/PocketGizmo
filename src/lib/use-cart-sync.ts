"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/lib/cart-store";

/** Waits for the persisted cart to load, then refreshes prices and stock from the database once. */
export function useCartSync() {
  const [ready, setReady] = useState(false);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (useCart.persist.hasHydrated()) setReady(true);
    return useCart.persist.onFinishHydration(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    const ids = useCart.getState().items.map((i) => i.variantId);
    if (!ids.length) return setSynced(true);
    const supabase = createClient();
    supabase
      .from("product_variants")
      .select("id, price, stock, is_active, products!inner(is_active)")
      .in("id", ids)
      .then(({ data, error }) => {
        if (error) return setSynced(true); // keep cart as-is; the server re-checks at checkout anyway
        const fresh = new Map(
          (data ?? []).map((v) => [v.id, { price: Number(v.price), stock: v.stock, available: v.is_active && v.products.is_active }]),
        );
        useCart.getState().sync(fresh).forEach((m) => toast.info(m));
        setSynced(true);
      });
  }, [ready]);

  return { ready, synced };
}
