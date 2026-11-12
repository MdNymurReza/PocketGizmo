"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  options: Record<string, string>;
  image: string | null;
  price: number; // display only; the server re-prices at checkout
  stock: number;
  quantity: number;
};

type CartState = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  /** Apply fresh price/stock from the server. Returns names of items that changed or were removed. */
  sync: (fresh: Map<string, { price: number; stock: number; available: boolean }>) => string[];
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item, qty = 1) =>
        set((s) => {
          const existing = s.items.find((i) => i.variantId === item.variantId);
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.variantId === item.variantId
                  ? { ...i, ...item, quantity: Math.min(i.quantity + qty, item.stock) }
                  : i,
              ),
            };
          }
          return { items: [...s.items, { ...item, quantity: Math.min(qty, item.stock) }] };
        }),
      setQty: (variantId, qty) =>
        set((s) => ({
          items: s.items
            .map((i) => (i.variantId === variantId ? { ...i, quantity: Math.max(0, Math.min(qty, i.stock)) } : i))
            .filter((i) => i.quantity > 0),
        })),
      remove: (variantId) => set((s) => ({ items: s.items.filter((i) => i.variantId !== variantId) })),
      clear: () => set({ items: [] }),
      sync: (fresh) => {
        const changed: string[] = [];
        set((s) => ({
          items: s.items.flatMap((i) => {
            const f = fresh.get(i.variantId);
            if (!f || !f.available || f.stock <= 0) {
              changed.push(`${i.name} is no longer available`);
              return [];
            }
            const quantity = Math.min(i.quantity, f.stock);
            if (quantity < i.quantity) changed.push(`Only ${f.stock} of ${i.name} left, so we updated your cart`);
            if (f.price !== i.price) changed.push(`The price of ${i.name} changed`);
            return [{ ...i, price: f.price, stock: f.stock, quantity }];
          }),
        }));
        return changed;
      },
    }),
    { name: "pg-cart", version: 1 },
  ),
);

export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.quantity, 0);
export const cartSubtotal = (items: CartItem[]) => items.reduce((n, i) => n + i.price * i.quantity, 0);
