import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/shop/legal-page";
import { getStoreSettings } from "@/lib/store-settings";
import { POLICY } from "@/lib/policy";

export const metadata: Metadata = { title: "Returns & refunds", description: "How returns, replacements and refunds work at PocketGizmo." };

export default async function RefundPolicyPage() {
  const s = await getStoreSettings();
  const hours = POLICY.reportWindowHours;
  return (
    <LegalPage
      title="Returns & refunds"
      current="/refund-policy"
      intro="Every piece is printed to order for you, so returns work a little differently from a regular shop. Here's how we handle problems."
    >
      <h2>Damaged, defective or wrong items</h2>
      <p>
        If your item arrives broken, has a printing defect, or isn&apos;t what you ordered, contact us within{" "}
        <strong>{hours} hours of delivery</strong> with your order number and clear photos (an unboxing video helps a lot).
        Once we confirm the problem, we&apos;ll do one of the following, whichever you prefer:
      </p>
      <ul>
        <li>reprint and send you a replacement at no extra cost, or</li>
        <li>give you a full refund for the affected item.</li>
      </ul>
      <p>We may ask you to send the item back. If so, we cover the return delivery cost for damaged or wrong items.</p>

      <h2>Change of mind</h2>
      {POLICY.changeOfMindDays > 0 ? (
        <p>
          You can return an unused item in its original condition within {POLICY.changeOfMindDays} days of delivery. The
          return delivery charge is paid by you, and the original delivery charge isn&apos;t refunded.
        </p>
      ) : (
        <p>
          Because items are made to order, we can&apos;t accept returns for a change of mind, a different color preference,
          or if you ordered the wrong size or model. Please check the product details before ordering, and ask us if
          you&apos;re unsure.
        </p>
      )}

      <h2>Natural variation in 3D prints</h2>
      <p>
        3D-printed items have fine layer lines, and colors can look slightly different from the photos on your screen.
        These are part of the process and aren&apos;t considered defects.
      </p>

      <h2>Custom orders</h2>
      <p>
        Custom prints are made to your design or specification, so they can&apos;t be returned or refunded unless they arrive
        damaged or don&apos;t match the specification you approved in our quote.
      </p>

      <h2>Cancelling an order</h2>
      <ul>
        <li>You can cancel free of charge before we start printing. Contact us as soon as possible.</li>
        <li>Once printing has started, the order can&apos;t be cancelled.</li>
        <li>An advance delivery charge is refunded only if we cancel the order, or if you cancel before printing starts.</li>
      </ul>

      <h2>How refunds are paid</h2>
      <p>
        Approved refunds are sent to the bKash, Nagad or Rocket number you paid from (or a number you give us for cash on
        delivery orders) within <strong>{POLICY.refundDays}</strong>. Delivery charges are refunded only when the problem was
        our mistake.
      </p>

      <h2>Contact us</h2>
      <p>
        Reach us <ContactLine phone={s.phone} email={s.email} />. Please include your order number.
      </p>
    </LegalPage>
  );
}
