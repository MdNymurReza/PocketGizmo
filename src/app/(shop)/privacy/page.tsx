import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/shop/legal-page";
import { getStoreSettings } from "@/lib/store-settings";
import { POLICY } from "@/lib/policy";

export const metadata: Metadata = { title: "Privacy policy", description: "What personal information PocketGizmo collects and how it's used." };

export default async function PrivacyPage() {
  const s = await getStoreSettings();
  return (
    <LegalPage
      title="Privacy policy"
      current="/privacy"
      intro="We only collect what we need to make and deliver your order, and we never sell your information."
    >
      <h2>What we collect</h2>
      <ul>
        <li><strong>Order details:</strong> your name, mobile number, email (optional), delivery address and the items you order.</li>
        <li><strong>Payment details:</strong> for bKash, Nagad or Rocket, the number you paid from and the Transaction ID. We never ask for your PIN or OTP, and we never will.</li>
        <li><strong>Account details:</strong> if you create an account, your email, password (stored securely, we can&apos;t see it) and saved addresses.</li>
        <li><strong>Custom print requests:</strong> the description and files you upload.</li>
        <li><strong>Technical data:</strong> basic information your browser sends, such as cookies needed to keep you logged in and remember your cart.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>to make, deliver and support your order, and to contact you about it;</li>
        <li>to verify payments and prevent fraud, including checking past orders from the same mobile number;</li>
        <li>to answer your questions and custom print requests;</li>
        <li>to keep our records and meet legal requirements.</li>
      </ul>

      <h2>Who we share it with</h2>
      <ul>
        <li><strong>Courier partners</strong> receive your name, phone number and address to deliver your parcel.</li>
        <li><strong>Service providers</strong> that run this website (hosting, database and security checks) process data for us under their own security terms.</li>
        <li>We may share information if required by law.</li>
      </ul>
      <p>We don&apos;t sell or rent your personal information.</p>

      <h2>Cookies</h2>
      <p>
        We use essential cookies and your browser&apos;s storage to keep you signed in and remember your cart. A security check
        (Cloudflare Turnstile) may run on forms to block spam.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep order records for as long as needed for accounting, warranty and legal purposes. Uploaded custom-print files
        are kept while your request is open and may be deleted afterwards.
      </p>

      <h2>Your choices</h2>
      <p>
        You can view and update your profile in your account. To ask for a copy of your data or for it to be deleted (where we
        don&apos;t need to keep it), contact us <ContactLine phone={s.phone} email={s.email} />.
      </p>

      <h2>Contact</h2>
      <p>
        {POLICY.businessName}, {POLICY.location}.
      </p>
    </LegalPage>
  );
}
