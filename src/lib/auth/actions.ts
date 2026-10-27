"use server";

import { redirect } from "next/navigation";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { SIGN_OUT_ERROR_MESSAGE, type SignOutState } from "./sign-out-state";

/**
 * «Esci»: ends the Supabase session, then goes home. Without a Supabase
 * config (CI, e2e) there is no session to end, so it only redirects.
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
  redirect("/");
}
