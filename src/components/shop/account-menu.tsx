"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { LogOut, Printer, ShieldCheck, User } from "lucide-react";
import { logout } from "@/app/(shop)/(auth)/actions";
import { buttonStyles } from "@/components/ui";
import { ACCOUNT_LINKS } from "./account-nav";

/** Header account button: a login link for guests, a dropdown menu for signed-in customers. */
export function AccountMenu({ user }: { user: { name: string; email: string; isAdmin: boolean; isSupplier?: boolean } | null }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const path = usePathname();

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) {
    return (
      <Link href="/login" className={buttonStyles({ variant: "ghost", size: "icon" })} aria-label="Log in">
        <User className="size-5" strokeWidth={1.75} />
      </Link>
    );
  }

  const row = "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink hover:bg-surface";

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={buttonStyles({ variant: "ghost", size: "icon" })}
        aria-label="My account menu"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <User className="size-5" strokeWidth={1.75} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-2 w-60 origin-top-right rounded-xl border border-line bg-white p-1.5 shadow-[0_16px_40px_-12px_rgba(11,11,15,0.25)]"
          >
            <div className="border-b border-line px-2.5 pt-1.5 pb-3">
              <p className="truncate text-sm font-semibold">{user.name || "My account"}</p>
              <p className="truncate text-xs text-ink-soft">{user.email}</p>
            </div>
            <ul className="py-1.5">
              {ACCOUNT_LINKS.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link href={href} className={row}>
                    <Icon className="size-4 text-ink-soft" strokeWidth={1.75} /> {label}
                  </Link>
                </li>
              ))}
              {user.isSupplier && (
                <li>
                  <Link href="/supplier" className={row}>
                    <Printer className="size-4 text-ink-soft" strokeWidth={1.75} /> Print jobs
                  </Link>
                </li>
              )}
              {user.isAdmin && (
                <li>
                  <Link href="/admin" className={row}>
                    <ShieldCheck className="size-4 text-ink-soft" strokeWidth={1.75} /> Store admin
                  </Link>
                </li>
              )}
            </ul>
            <form action={logout} className="border-t border-line pt-1.5">
              <button type="submit" className={row}>
                <LogOut className="size-4 text-ink-soft" strokeWidth={1.75} /> Log out
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
