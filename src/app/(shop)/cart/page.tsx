import type { Metadata } from "next";
import { CartView } from "@/components/shop/cart-view";

export const metadata: Metadata = { title: "Cart" };

export default function CartPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold">Shopping cart</h1>
      <CartView />
    </div>
  );
}
