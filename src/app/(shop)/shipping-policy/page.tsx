import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine, LegalPage } from "@/components/shop/legal-page";
import { getStoreSettings } from "@/lib/store-settings";
import { POLICY } from "@/lib/policy";
import { formatBDT } from "@/lib/utils";

export const metadata: Metadata = { title: "Shipping policy", description: "Delivery charges, times and coverage for PocketGizmo orders." };

export default async function ShippingPolicyPage() {
  const s = await getStoreSettings();
  return (
    <LegalPage title="Shipping policy" current="/shipping-policy" intro="We deliver to all 64 districts of Bangladesh.">
      <h2>Processing time</h2>
      <p>
        Every item is 3D-printed to order. After your order is confirmed, printing and quality checks usually take{" "}
        <strong>{POLICY.printingDays}</strong>. Larger or custom orders can take longer; we&apos;ll tell you if so.
      </p>

      <h2>Delivery charges and times</h2>
      <ul>
        <li>
          <strong>Inside Dhaka:</strong> {formatBDT(s.insideDhaka)}, usually {POLICY.deliveryInsideDhaka} after shipping.
        </li>
        <li>
          <strong>Outside Dhaka:</strong> {formatBDT(s.outsideDhaka)}, usually {POLICY.deliveryOutsideDhaka} after shipping.
        </li>
        {s.freeOver != null && (
          <li>
            <strong>Free delivery</strong> on orders over {formatBDT(s.freeOver)} (after discounts).
          </li>
        )}
      </ul>
      <p>Delivery times are estimates from our courier partners and can be longer during holidays, bad weather or strikes.</p>

      <h2>Cash on delivery</h2>
      <p>
        Cash on delivery is available everywhere we deliver.
        {s.codAdvance === "all" && " For cash on delivery orders we ask for the delivery charge in advance by bKash, Nagad or Rocket; you pay the rest when the parcel arrives."}
        {s.codAdvance === "outside_dhaka" && " For cash on delivery orders outside Dhaka we ask for the delivery charge in advance by bKash, Nagad or Rocket; you pay the rest when the parcel arrives."}
      </p>

      <h2>Tracking your order</h2>
      <p>
        Once your order ships, you&apos;ll find the courier and tracking number on your order page. You can check it any time on
        the <Link href="/track">Track order</Link> page with your order number and mobile number.
      </p>

      <h2>Receiving your parcel</h2>
      <ul>
        <li>Please make sure someone is available at the address and on the phone number you gave us.</li>
        <li>Check the parcel in front of the delivery person if you can. If it looks damaged, take photos before opening it.</li>
        <li>If a parcel is refused or can&apos;t be delivered after repeated attempts, it&apos;s returned to us and we may not offer cash on delivery to that number again.</li>
      </ul>

      <h2>Questions</h2>
      <p>
        Contact us <ContactLine phone={s.phone} email={s.email} /> with your order number.
      </p>
    </LegalPage>
  );
}
