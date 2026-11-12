import "server-only";

/**
 * Verifies a Cloudflare Turnstile token. When TURNSTILE_SECRET_KEY isn't set
 * the check is skipped (local development), so set it in production.
 */
export async function verifyCaptcha(token: string | undefined | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    // If Cloudflare is unreachable, don't block real customers.
    return true;
  }
}

export const CAPTCHA_ERROR = "Please complete the security check and try again.";
