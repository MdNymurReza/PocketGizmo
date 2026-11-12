import Link from "next/link";
import type { Metadata } from "next";
import { signup } from "../actions";
import { AuthForm, AuthShell } from "@/components/shop/auth-form";
import { Field, Input } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <AuthShell title="Join PocketGizmo" subtitle="Save addresses, track orders and get member deals.">
      <AuthForm action={signup} submitLabel="Create account">
        <Field label="Full name">
          <Input name="full_name" autoComplete="name" required />
        </Field>
        <Field label="Mobile number" hint="We'll use this for delivery updates">
          <Input name="phone" type="tel" inputMode="tel" placeholder="01XXXXXXXXX" autoComplete="tel" required />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" hint="At least 8 characters">
          <PasswordInput name="password" autoComplete="new-password" minLength={8} required />
        </Field>
      </AuthForm>
      <p className="mt-8 text-center text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4 hover:text-accent">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
