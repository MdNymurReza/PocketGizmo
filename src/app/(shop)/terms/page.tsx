import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine, LegalPage } from "@/components/shop/legal-page";
import { getStoreSettings } from "@/lib/store-settings";
import { POLICY } from "@/lib/policy";

export const metadata: Metadata = { title: "Terms of service", description: "The terms that apply when you shop with PocketGizmo." };

export default async function TermsPage() {
  const s = await getStoreSettings();
  return (
    <LegalPage
      title="Terms of service"
      current="/terms"
      intro={`These terms apply when you use this website or buy from ${POLICY.businessName}. By placing an order you agree to them.`}
    >
      <h2>About us</h2>
      <p>
        {POLICY.businessName} designs and 3D-prints accessories in {POLICY.location}. You can contact us{" "}
        <ContactLine phone={s.phone} email={s.email} />.
      </p>

      <h2>Products and prices</h2>
      <ul>
        <li>All prices are in Bangladeshi Taka (৳). Delivery charges are shown at checkout before you place your order.</li>
        <li>Product photos are representative. Because items are printed to order, small differences in color and surface finish are normal.</li>
        <li>We try to keep prices and stock correct, but mistakes can happen. If a price is clearly wrong, we&apos;ll contact you before processing the order, and you can cancel.</li>
      </ul>

      <h2>Orders</h2>
      <ul>
        <li>An order is accepted once we confirm it. We may decline or cancel an order, for example if an item can&apos;t be made, a payment can&apos;t be verified, or the order looks fraudulent.</li>
        <li>Please give an accurate name, phone number and address. We use them to confirm and deliver your order.</li>
        <li>We may refuse cash on delivery, or block online orders, from numbers that have refused parcels or placed fake orders.</li>
      </ul>

      <h2>Payment</h2>
      <ul>
        <li>We accept bKash, Nagad, Rocket and cash on delivery. For mobile payments, send the exact amount and enter the correct Transaction ID; the order is confirmed after we verify it.</li>
        <li>If a Transaction ID can&apos;t be verified, the order won&apos;t be processed until the payment is sorted out.</li>
        <li>Coupon codes have their own conditions, can&apos;t be exchanged for cash, and one coupon applies per order.</li>
      </ul>

      <h2>Delivery, returns and refunds</h2>
      <p>
        Delivery is covered by our <Link href="/shipping-policy">Shipping policy</Link>, and problems with an order by our{" "}
        <Link href="/refund-policy">Returns &amp; refunds policy</Link>.
      </p>

      <h2>Custom prints</h2>
      <ul>
        <li>When you send us a file or design, you confirm you have the right to use it and that printing it doesn&apos;t break anyone else&apos;s rights.</li>
        <li>We may decline requests we can&apos;t print well, or that are unsafe, illegal or infringe someone&apos;s intellectual property.</li>
        <li>A quote is valid for 7 days. Work starts after you accept the quote and any required payment is received.</li>
      </ul>

      <h2>Use of the website</h2>
      <p>
        Please don&apos;t misuse the website, for example by placing fake orders, trying to access other people&apos;s accounts or
        orders, or interfering with how the site works. The website content, product designs and photos belong to{" "}
        {POLICY.businessName} and may not be copied without permission.
      </p>

      <h2>Liability</h2>
      <p>
        Our products are accessories and aren&apos;t intended for safety-critical uses. To the extent allowed by law, our
        responsibility for any order is limited to the amount you paid for it. Nothing in these terms limits your rights
        under the laws of Bangladesh, including the Consumer Rights Protection Act, 2009.
      </p>

      <h2>Changes</h2>
      <p>We may update these terms from time to time. The version on this page when you place an order applies to that order.</p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of Bangladesh.</p>
    </LegalPage>
  );
}
