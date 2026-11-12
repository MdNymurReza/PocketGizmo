"use client";

import Script from "next/script";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

/**
 * Cloudflare Turnstile spam check. Renders nothing when
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't set, so local development keeps working.
 */
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type TurnstileHandle = { reset: () => void };

export const Turnstile = forwardRef<TurnstileHandle, { onToken: (token: string) => void; className?: string }>(
  function Turnstile({ onToken, className }, ref) {
    const box = useRef<HTMLDivElement>(null);
    const widget = useRef<string | null>(null);
    const [loaded, setLoaded] = useState(() => typeof window !== "undefined" && Boolean(window.turnstile));
    const tokenCb = useRef(onToken);
    useEffect(() => {
      tokenCb.current = onToken;
    }, [onToken]);

    const mount = useCallback(() => {
      if (!SITE_KEY || !box.current || !window.turnstile || widget.current) return;
      widget.current = window.turnstile.render(box.current, {
        sitekey: SITE_KEY,
        theme: "light",
        size: "flexible",
        callback: (t: string) => tokenCb.current(t),
        "expired-callback": () => tokenCb.current(""),
        "error-callback": () => tokenCb.current(""),
      });
    }, []);

    useEffect(() => {
      if (loaded) mount();
      return () => {
        if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
        widget.current = null;
      };
    }, [loaded, mount]);

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (widget.current && window.turnstile) window.turnstile.reset(widget.current);
      },
    }));

    if (!SITE_KEY) return null;
    return (
      <>
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={() => setLoaded(true)}
          onReady={() => setLoaded(true)}
        />
        <div ref={box} className={className} />
      </>
    );
  },
);
