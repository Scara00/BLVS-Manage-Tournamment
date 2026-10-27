import "server-only";
import { cookies } from "next/headers";
import { now } from "@/lib/time/server-time";
import { CONFIRMATION_LINK_TTL_SECONDS } from "./constants";

/**
 * The registration waiting for confirmation in this browser: who signed up
 * and when the last link was sent. Without a session (Supabase Auth gives
 * none before the confirmation) this is how the page knows the address,
 * the expiry and the resend cooldown. It holds no secret: the token lives
 * only in the email.
 */
export type PendingVerification = { email: string; inviataIl: Date };

export const PENDING_VERIFICATION_COOKIE = "blvs_conferma_email";

/** Kept a day: enough to come back and ask for a new link. */
const MAX_AGE_SECONDS = Math.max(CONFIRMATION_LINK_TTL_SECONDS, 24 * 60 * 60);

export function encodePending({ email, inviataIl }: PendingVerification) {
  return Buffer.from(
    JSON.stringify({ e: email, t: inviataIl.toISOString() }),
  ).toString("base64url");
}

export function decodePending(
  raw: string | undefined,
): PendingVerification | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    );
    if (!value || typeof value !== "object") return null;
    const { e, t } = value as Record<string, unknown>;
    if (typeof e !== "string" || !e.includes("@") || e.length > 320)
      return null;
    if (typeof t !== "string") return null;
    const inviataIl = new Date(t);
    if (Number.isNaN(inviataIl.getTime())) return null;
    return { email: e, inviataIl };
  } catch {
    return null;
  }
}

/** Call after `signUp` or a resend: remembers address and send time. */
export async function rememberPendingVerification(
  email: string,
  inviataIl: Date = now(),
): Promise<void> {
  const store = await cookies();
  store.set(PENDING_VERIFICATION_COOKIE, encodePending({ email, inviataIl }), {
    httpOnly: true,
    sameSite: "lax",
    // Same switch as HSTS: on for Vercel Preview and Production (HTTPS).
    secure: process.env.ENFORCE_HTTPS === "true",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function readPendingVerification(): Promise<PendingVerification | null> {
  const store = await cookies();
  return decodePending(store.get(PENDING_VERIFICATION_COOKIE)?.value);
}

export async function clearPendingVerification(): Promise<void> {
  const store = await cookies();
  store.delete({ name: PENDING_VERIFICATION_COOKIE, path: "/" });
}
