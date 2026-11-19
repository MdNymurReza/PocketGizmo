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
  /** Optional note for this item, e.g. the name and number for a jersey. */
  details?: string;
  /** The product can be ordered past its stock. */
  preorder?: boolean;
  /** For pre-order items: how many are ready now (`stock` holds the higher order limit). */
  ready?: number;
};

/** How many of this line are printed after the order, because they aren't in stock. */
export const preorderCount = (i: Pick<CartItem, "preorder" | "ready" | "quantity">) =>
  i.preorder ? Math.max(0, i.quantity - Math.max(0, i.ready ?? 0)) : 0;

export const DETAILS_MAX = 300;
/** How many of a pre-order item one order can hold. */
export const PREORDER_MAX = 20;

type CartState = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  setQty: (variantId: string, qty: number) => void;
  setDetails: (variantId: string, details: string) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  /** Apply fresh price/stock from the server. Returns names of items that changed or were removed. */
  sync: (fresh: Map<string, { price: number; stock: number; available: boolean; preorder: boolean }>) => string[];
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
                  ? { ...i, ...item, details: item.details || i.details, quantity: Math.min(i.quantity + qty, item.stock) }
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
      setDetails: (variantId, details) =>
        set((s) => ({ items: s.items.map((i) => (i.variantId === variantId ? { ...i, details: details.slice(0, DETAILS_MAX) } : i)) })),
      remove: (variantId) => set((s) => ({ items: s.items.filter((i) => i.variantId !== variantId) })),
      clear: () => set({ items: [] }),
      sync: (fresh) => {
        const changed: string[] = [];
        set((s) => ({
          items: s.items.flatMap((i) => {
            const f = fresh.get(i.variantId);
            const stock = f?.preorder ? Math.max(f.stock, PREORDER_MAX) : (f?.stock ?? 0);
            if (!f || !f.available || stock <= 0) {
              changed.push(`${i.name} is no longer available`);
              return [];
            }
            const quantity = Math.min(i.quantity, stock);
            if (quantity < i.quantity) changed.push(`Only ${stock} of ${i.name} left, so we updated your cart`);
            if (f.price !== i.price) changed.push(`The price of ${i.name} changed`);
            return [{ ...i, price: f.price, stock, preorder: f.preorder || undefined, ready: f.preorder ? f.stock : undefined, quantity }];
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
