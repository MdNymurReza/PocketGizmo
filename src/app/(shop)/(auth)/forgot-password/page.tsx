import type { Metadata } from "next";
import { forgotPassword } from "../actions";
import { AuthForm, AuthShell } from "@/components/shop/auth-form";
import { Field, Input } from "@/components/ui";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Forgot password?" subtitle="No worries, we'll email you a reset link.">
      <AuthForm action={forgotPassword} submitLabel="Send reset link">
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
      </AuthForm>
    </AuthShell>
  );
}
