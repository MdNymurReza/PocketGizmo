import Link from "next/link";
import { POLICY, POLICY_PAGES } from "@/lib/policy";
import { cn } from "@/lib/utils";

/** Shared layout for policy pages: side navigation + readable prose. */
export function LegalPage({ title, intro, current, children }: { title: string; intro?: string; current: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[200px_1fr] lg:gap-16">
        <nav aria-label="Policies" className="lg:sticky lg:top-24 lg:h-fit">
          <p className="mb-3 text-xs font-semibold tracking-wide text-ink-soft uppercase">Policies</p>
          <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-0.5">
            {POLICY_PAGES.map((p) => (
              <li key={p.href}>
                <Link
                  href={p.href}
                  aria-current={current === p.href ? "page" : undefined}
                  className={cn(
                    "block rounded-md px-3 py-1.5 text-sm transition-colors lg:px-2",
                    current === p.href ? "bg-surface font-medium text-ink" : "text-ink-soft hover:text-ink",
                  )}
                >
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <article className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-ink-soft">Last updated {POLICY.lastUpdated}</p>
          {intro && <p className="mt-6 text-lg text-ink-soft">{intro}</p>}
          <div className="legal mt-8">{children}</div>
        </article>
      </div>
    </div>
  );
}

/** Contact line built from the store settings. */
export function ContactLine({ phone, email }: { phone: string | null; email: string | null }) {
  if (!phone && !email) return <>through our Facebook page or the contact details on this website</>;
  return (
    <>
      {phone && (
        <>
          by phone at <a href={`tel:${phone}`}>{phone}</a>
        </>
      )}
      {phone && email && " or "}
      {email && (
        <>
          by email at <a href={`mailto:${email}`}>{email}</a>
        </>
      )}
    </>
  );
}
