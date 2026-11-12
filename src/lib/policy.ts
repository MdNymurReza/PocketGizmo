/**
 * Store policy settings used by the Terms, Privacy, Shipping and Refund pages.
 * These are sensible defaults for a made-to-order 3D printing shop.
 * REVIEW AND EDIT THEM to match how you actually run the business.
 */
export const POLICY = {
  /** Shown as "Last updated" on every policy page. */
  lastUpdated: "13 November 2026",
  /** Legal/business name shown in the policies. */
  businessName: "PocketGizmo",
  /** Where the business is based. */
  location: "Dhaka, Bangladesh",

  /** Days needed to print an order before it ships. */
  printingDays: "1–3 working days",
  /** Courier delivery time after shipping. */
  deliveryInsideDhaka: "1–2 days",
  deliveryOutsideDhaka: "2–4 days",

  /** How long after delivery a customer can report a problem. */
  reportWindowHours: 48,
  /** How long after delivery an unused item can be returned for a change of mind (0 = not accepted). */
  changeOfMindDays: 0,
  /** How long refunds take once approved. */
  refundDays: "3–7 working days",
} as const;

export const POLICY_PAGES = [
  { href: "/shipping-policy", label: "Shipping policy" },
  { href: "/refund-policy", label: "Returns & refunds" },
  { href: "/terms", label: "Terms of service" },
  { href: "/privacy", label: "Privacy policy" },
] as const;
