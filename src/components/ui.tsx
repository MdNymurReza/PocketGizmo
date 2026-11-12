import * as React from "react";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  {
    variants: {
      variant: {
        primary: "bg-ink text-white hover:bg-ink/85",
        accent: "bg-accent text-white hover:bg-accent-hover",
        secondary: "border border-line bg-white text-ink shadow-xs hover:bg-surface",
        ghost: "text-ink hover:bg-surface",
        danger: "border border-line bg-white text-danger hover:bg-danger/5",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonStyles({ variant, size }), className)} {...props} />;
}

export function ButtonLink({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof Link> & VariantProps<typeof buttonStyles>) {
  return <Link className={cn(buttonStyles({ variant, size }), className)} {...props} />;
}

const fieldBase =
  "w-full rounded-lg border border-line bg-white px-3 text-sm text-ink shadow-xs transition-colors placeholder:text-ink-soft/70 hover:border-ink/25 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 disabled:bg-surface disabled:opacity-70";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "min-h-24 py-2", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldBase, "h-10 pr-8", className)} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error ? (
        <span className="text-sm text-danger">{error}</span>
      ) : hint ? (
        <span className="text-xs text-ink-soft">{hint}</span>
      ) : null}
    </label>
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-line bg-white p-5 shadow-xs", className)} {...props} />;
}

const badgeColors = {
  neutral: "bg-surface-2 text-ink-soft",
  accent: "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  info: "bg-info/10 text-info",
} as const;

export type BadgeColor = keyof typeof badgeColors;

export function Badge({
  color = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { color?: BadgeColor }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        badgeColors[color],
        className,
      )}
      {...props}
    />
  );
}

export function Checkbox({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm font-medium select-none">
      <input type="checkbox" className="size-4 rounded accent-accent" {...props} />
      {label}
    </label>
  );
}

export function PageTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">{children}</h1>
      {action}
    </div>
  );
}

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-lg font-semibold tracking-tight", className)}>
      <span className={cn("grid size-7 place-items-center rounded-md", inverted ? "bg-white text-ink" : "bg-ink text-white")}>
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinejoin="round" aria-hidden>
          <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
          <path d="M4 7.5 12 12l8-4.5M12 12v9" />
        </svg>
      </span>
      PocketGizmo
    </span>
  );
}
