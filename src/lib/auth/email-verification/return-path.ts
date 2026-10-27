import "server-only";
import { cookies } from "next/headers";
import {
  RETURN_PARAM,
  safeReturnPath,
} from "@/lib/navigation/safe-return-path";
import { EMAIL_VERIFY_PATH } from "./constants";

/**
 * Where to go back after confirming the email, e.g. the stage the player
 * was registering to (BLVS-24). Kept in a cookie because the link in the
 * email lands on `/registrati/conferma-email?esito=…` without it.
 */
export const RETURN_AFTER_CONFIRMATION_COOKIE = "blvs_dopo_conferma";

/** w-email-verify that brings the player back to `from` once confirmed. */
export function emailVerifyHref(from: string): string {
  const back = safeReturnPath(from, "");
  return back
    ? `${EMAIL_VERIFY_PATH}?${RETURN_PARAM}=${encodeURIComponent(back)}`
    : EMAIL_VERIFY_PATH;
}

/** Call from a server action or route handler before sending to the page. */
export async function rememberReturnAfterConfirmation(
  from: string,
): Promise<void> {
  const back = safeReturnPath(from, "");
  if (!back) return;
  const store = await cookies();
  store.set(RETURN_AFTER_CONFIRMATION_COOKIE, back, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.ENFORCE_HTTPS === "true",
    path: "/",
    maxAge: 24 * 60 * 60,
  });
}

/** `?da=` first, then the cookie; null when neither is a safe internal path. */
export async function readReturnAfterConfirmation(
  da: string | string[] | undefined,
): Promise<string | null> {
  const fromQuery = safeReturnPath(da, "");
  if (fromQuery) return fromQuery;
  const store = await cookies();
  return (
    safeReturnPath(store.get(RETURN_AFTER_CONFIRMATION_COOKIE)?.value, "") ||
    null
  );
}
