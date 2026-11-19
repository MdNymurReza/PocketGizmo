"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MessageCircle, X } from "lucide-react";

/** WhatsApp and Facebook Messenger brand marks, drawn simply. */
function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}
function MessengerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
      <path d="M12 2C6.4 2 2 6.1 2 11.7c0 2.9 1.2 5.5 3.2 7.2v3.5l3-1.7c1.2.3 2.5.5 3.8.5 5.6 0 10-4.1 10-9.6S17.6 2 12 2Zm1 12.9-2.6-2.7-5 2.7 5.5-5.8 2.6 2.7 4.9-2.7-5.4 5.8Z" />
    </svg>
  );
}

/** A floating chat button with WhatsApp and Messenger, shown on every shop page. */
export function ChatButton({ whatsapp, messenger }: { whatsapp: string | null; messenger: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!whatsapp && !messenger) return null;
  const links = [
    whatsapp && { href: whatsapp, label: "WhatsApp", icon: <WhatsAppIcon />, color: "#25D366" },
    messenger && { href: messenger, label: "Messenger", icon: <MessengerIcon />, color: "#0866FF" },
  ].filter(Boolean) as { href: string; label: string; icon: React.ReactNode; color: string }[];

  return (
    <div ref={ref} className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-2 print:hidden sm:right-6 sm:bottom-6">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="w-56 rounded-2xl border border-line bg-white p-2 shadow-xl shadow-ink/10"
            role="menu"
          >
            <p className="px-3 pt-2 pb-1 text-xs text-ink-soft">Questions? Chat with us</p>
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-surface"
                onClick={() => setOpen(false)}
              >
                <span className="grid size-8 place-items-center rounded-full text-white" style={{ background: l.color }}>
                  {l.icon}
                </span>
                {l.label}
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close chat options" : "Chat with us"}
        className="grid size-14 place-items-center rounded-full bg-accent text-white shadow-lg shadow-accent/30 transition-transform hover:scale-105 active:scale-95"
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>
    </div>
  );
}
