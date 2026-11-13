import type { Metadata } from "next";
import { CartView } from "@/components/shop/cart-view";
import { getStoreSettings } from "@/lib/store-settings";

export const metadata: Metadata = { title: "Cart" };

export default async function CartPage() {
  const { freeOver } = await getStoreSettings();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold">Shopping cart</h1>
      <CartView freeOver={freeOver} />
    </div>
  );
}
