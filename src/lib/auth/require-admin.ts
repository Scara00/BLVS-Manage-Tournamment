import "server-only";
import { forbidden, redirect } from "next/navigation";
import { loginHref } from "@/lib/navigation/auth-paths";
import { readSupabaseEnv } from "@/lib/supabase/env";
import type { AdminUser } from "./guards";
import { getCurrentUser } from "./session";

/**
 * Authoritative check for admin pages (Server Components): the session is
 * verified and the role read from `public.utenti`. Nobody signed in → login
 * (the proxy normally got there first); a player → 403 (BLVS-10).
 * Without Supabase env (CI, e2e) there is nobody to check: returns `null`.
 */
export async function requireAdmin(from = "/admin"): Promise<AdminUser | null> {
  if (!readSupabaseEnv()) return null;

  const user = await getCurrentUser();
  if (!user) redirect(loginHref(from));
  if (user.ruolo !== "admin") forbidden();
  return user as AdminUser;
}
