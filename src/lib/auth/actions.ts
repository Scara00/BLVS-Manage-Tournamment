"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BodyReader } from "@/lib/api/validation";
import type { Ruolo } from "@/lib/db/types";
import { loginHref, safeAfterLoginPath } from "@/lib/navigation/auth-paths";
import { RETURN_PARAM } from "@/lib/navigation/safe-return-path";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  INVALID_CREDENTIALS_MESSAGE,
  rateLimitedLoginMessage,
} from "./messages";
import { checkAuthAttempt, clientIp } from "./rate-limit";
import {
  LOGIN_UNAVAILABLE_MESSAGE,
  PERMISSION_DENIED_MESSAGE,
  type SignInState,
} from "./sign-in-state";
import { SIGN_OUT_ERROR_MESSAGE, type SignOutState } from "./sign-out-state";

function isAdminPath(path: string): boolean {
  const { pathname } = new URL(path, "http://blvs.invalid");
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * «Accedi»: email + password, then back to the page named by the hidden
 * `da` field (internal paths only). Every attempt counts towards the limit,
 * malformed ones too. Wrong email and wrong password get the same message.
 */
export async function signIn(
  prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const raw = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : undefined;
  };
  const attempt = prev.attempt + 1;
  const looseEmail = raw("email")?.trim() ?? "";
  const target = safeAfterLoginPath(raw(RETURN_PARAM));

  const check = await checkAuthAttempt(
    clientIp({ headers: await headers() }),
    "login",
    looseEmail || null,
  );
  if (check.status === "unavailable")
    return {
      status: "unavailable",
      message: LOGIN_UNAVAILABLE_MESSAGE,
      email: looseEmail,
      attempt,
    };
  if (check.status === "blocked")
    return {
      status: "rateLimited",
      message: rateLimitedLoginMessage(check.retryAt, check.retryAfterSeconds),
      retryAt: check.retryAt.toISOString(),
      email: looseEmail,
      attempt,
    };

  const reader = new BodyReader({
    email: raw("email"),
    password: raw("password"),
  });
  const email = reader.email();
  const password = reader.password();
  if (!reader.ok || !email || !password)
    return {
      status: "fieldErrors",
      fieldErrors: reader.errors,
      email: looseEmail,
      attempt,
    };

  if (!readSupabaseEnv())
    return {
      status: "unavailable",
      message: LOGIN_UNAVAILABLE_MESSAGE,
      email,
      attempt,
    };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user) {
    // Same answer for unknown email and wrong password (no enumeration).
    if (error && error.status !== 400)
      console.error("[auth] login non riuscito", error);
    return {
      status: "invalid",
      message: INVALID_CREDENTIALS_MESSAGE,
      email,
      attempt,
    };
  }

  const toHome = target === "/";
  if (toHome || isAdminPath(target)) {
    const { data: utente } = await supabase
      .from("utenti")
      .select("ruolo")
      .eq("id", data.user.id)
      .maybeSingle<{ ruolo: Ruolo }>();
    const isAdmin = utente?.ruolo === "admin";
    if (!toHome && !isAdmin)
      return {
        status: "permissionDenied",
        message: PERMISSION_DENIED_MESSAGE,
        email,
        attempt,
      };
    // With no page to go back to, an admin starts from the dashboard: the
    // player navigation has no way into the admin area.
    if (toHome && isAdmin) redirect("/admin");
  }

  redirect(target);
}

/**
 * «Esci»: ends the Supabase session (the refresh token is revoked on the
 * server, not only the cookies cleared), then goes to the login page with
 * the «uscita avvenuta» notice. Without a Supabase config (CI, e2e) there
 * is no session to end, so it only redirects.
 * A failed sign-out keeps the session, so it is logged and returned to the
 * form instead of redirecting as if the user had left. It ignores the
 * `useActionState` arguments (previous state, form data).
 */
export async function signOut(): Promise<SignOutState> {
  if (readSupabaseEnv()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[auth] signOut failed", error);
      return { error: SIGN_OUT_ERROR_MESSAGE };
    }
  }
  redirect(loginHref(null, { signedOut: true }));
}
