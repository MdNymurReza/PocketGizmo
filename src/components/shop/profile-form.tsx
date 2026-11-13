"use client";

import { useActionState } from "react";
import { Check, Loader2 } from "lucide-react";
import { changePassword, updateProfile, type ProfileState } from "@/app/(shop)/account/actions";
import { Button, Field, Input } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";

function Result({ state, ok }: { state: ProfileState; ok: string }) {
  if (state?.ok)
    return (
      <span role="status" className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
        <Check className="size-4" /> {ok}
      </span>
    );
  if (state?.error)
    return (
      <span role="alert" className="text-sm text-danger">
        {state.error}
      </span>
    );
  return null;
}

export function ProfileForm({ fullName, phone, email }: { fullName: string; phone: string; email?: string }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name">
        <Input name="full_name" defaultValue={fullName} autoComplete="name" required />
      </Field>
      <Field label="Mobile number">
        <Input name="phone" type="tel" inputMode="tel" defaultValue={phone} placeholder="01XXXXXXXXX" autoComplete="tel" required />
      </Field>
      {email && (
        <Field label="Email" hint="Your login email can't be changed here." className="sm:col-span-2">
          <Input value={email} readOnly disabled />
        </Field>
      )}
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <Result state={state} ok="Saved" />
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="New password">
        <PasswordInput name="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label="Confirm new password">
        <PasswordInput name="confirm" autoComplete="new-password" minLength={8} required />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {pending ? "Updating…" : "Update password"}
        </Button>
        <Result state={state} ok="Password updated" />
      </div>
    </form>
  );
}
