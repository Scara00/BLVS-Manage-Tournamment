import type { NextRequest } from "next/server";

/** Supabase auth cookie, possibly chunked: `sb-<ref>-auth-token[.N]`. */
export const AUTH_COOKIE = /^sb-.+-auth-token(?:\.\d+)?$/;

/** The request carries a (non-empty) Supabase auth cookie. */
export function haCookieDiSessione(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((cookie) => AUTH_COOKIE.test(cookie.name) && cookie.value !== "");
}
