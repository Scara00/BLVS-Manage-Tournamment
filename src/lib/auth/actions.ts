"use server";

import { redirect } from "next/navigation";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/**
 * «Esci»: ends the Supabase session, then goes home. Without a Supabase
 * config (CI, e2e) there is no session to end, so it only redirects.
 */
export async function signOut() {
  if (readSupabaseEnv()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
