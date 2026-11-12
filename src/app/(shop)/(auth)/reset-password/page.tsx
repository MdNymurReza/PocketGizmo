import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resetPassword } from "../actions";
import { AuthForm, AuthShell } from "@/components/shop/auth-form";
import { Field } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Set new password" };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/forgot-password");

  return (
    <AuthShell title="Set a new password">
      <AuthForm action={resetPassword} submitLabel="Save password">
        <Field label="New password" hint="At least 8 characters">
          <PasswordInput name="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <Field label="Confirm password">
          <PasswordInput name="confirm" autoComplete="new-password" minLength={8} required />
        </Field>
      </AuthForm>
    </AuthShell>
  );
}
