"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/(shop)/account/actions";
import { Button, Field, Input } from "@/components/ui";

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name">
        <Input name="full_name" defaultValue={fullName} required />
      </Field>
      <Field label="Mobile number">
        <Input name="phone" type="tel" defaultValue={phone} required />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
        {state?.ok && <span role="status" className="text-sm text-success">Saved</span>}
        {state?.error && <span role="alert" className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
