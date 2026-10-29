import "server-only";
import { forbidden, redirect } from "next/navigation";
import { loginHref } from "@/lib/navigation/auth-paths";
import { readSupabaseEnv } from "@/lib/supabase/env";
import type { AdminUser } from "./guards";
import { readCurrentUser } from "./session";

/**
 * Authoritative check for admin pages (Server Components): the session is
 * verified and the role read from `public.utenti`. Nobody signed in → login
 * (the proxy normally got there first); a player → 403 (BLVS-10).
 * A profile that cannot be read throws, so the error page shows: sending a
 * signed-in user to the login would bounce straight back here.
 * Without Supabase env (CI, e2e) there is nobody to check: returns `null`.
 */
export async function requireAdmin(from = "/admin"): Promise<AdminUser | null> {
  if (!readSupabaseEnv()) return null;

  const result = await readCurrentUser();
  if (result.status === "error")
    throw new Error("Profilo non leggibile: accesso admin non verificato");
  if (result.status === "signedOut") redirect(loginHref(from));
  if (result.user.ruolo !== "admin") forbidden();
  return result.user as AdminUser;
}
