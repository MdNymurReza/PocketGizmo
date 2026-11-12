"use client";

import { useActionState } from "react";
import { CircleCheck, Loader2 } from "lucide-react";
import type { AuthState } from "@/app/(shop)/(auth)/actions";
import { Button } from "@/components/ui";

export function AuthForm({
  action,
  submitLabel,
  children,
}: {
  action: (state: AuthState, formData: FormData) => Promise<AuthState>;
  submitLabel: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  if (state?.message) {
    return (
      <div role="status" className="flex gap-3 rounded-lg border border-success/20 bg-success/5 p-4 text-sm">
        <CircleCheck className="size-5 shrink-0 text-success" />
        {state.message}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {children}
      {state?.error && (
        <p role="alert" className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" className="mt-1" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending ? "Please wait…" : submitLabel}
      </Button>
    </form>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface/60 px-4 py-14 sm:py-20">
      <div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-6 shadow-[0_12px_40px_-20px_rgba(11,11,15,0.2)] sm:p-10">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-ink-soft">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
