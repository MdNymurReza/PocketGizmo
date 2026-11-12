import "server-only";

/**
 * Sends an alert to the store owner's Telegram (bot message).
 * Needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID; silently does nothing without them.
 * Never throws: a failed alert must not break checkout.
 */
export async function notifyAdmin(html: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: "HTML", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error("Telegram alert failed", res.status, await res.text());
  } catch (e) {
    console.error("Telegram alert failed", e);
  }
}

/** Escape text for Telegram's HTML mode. */
export const esc = (s: string | number | null | undefined) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const siteUrl = (path: string) => `${(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")}${path}`;
