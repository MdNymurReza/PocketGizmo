import Link from "next/link";
import { ButtonLink, Logo } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <Link href="/" aria-label="PocketGizmo home">
          <Logo priority className="mx-auto h-28" />
        </Link>
        <p className="mt-10 text-sm font-medium text-accent">404</p>
        <h1 className="mt-2 text-3xl font-semibold">Page not found</h1>
        <p className="mt-2 text-ink-soft">Sorry, we couldn&apos;t find the page you&apos;re looking for.</p>
        <ButtonLink href="/shop" className="mt-8">Back to shop</ButtonLink>
      </div>
    </div>
  );
}
