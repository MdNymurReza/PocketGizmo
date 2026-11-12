import Link from "next/link";
import type { Metadata } from "next";
import { login } from "../actions";
import { AuthForm, AuthShell } from "@/components/shop/auth-form";
import { Field, Input } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthShell title="Welcome back!" subtitle="Log in to track orders and check out faster.">
      <AuthForm action={login} submitLabel="Log in">
        <input type="hidden" name="next" value={next ?? "/account"} />
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password">
          <PasswordInput name="password" autoComplete="current-password" required />
        </Field>
        <Link href="/forgot-password" className="-mt-2 self-end text-sm text-ink-soft hover:text-ink">
          Forgot password?
        </Link>
      </AuthForm>
      <p className="mt-8 text-center text-sm text-ink-soft">
        New here?{" "}
        <Link href="/signup" className="font-medium text-ink underline underline-offset-4 hover:text-accent">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
