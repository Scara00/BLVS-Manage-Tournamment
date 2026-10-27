import { jsonError, noContent } from "@/lib/api/responses";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/** POST /api/auth/logout — ends the session and clears its cookies. */
export async function POST() {
  if (!readSupabaseEnv()) return noContent();

  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("[auth] logout non riuscito", error);
    return jsonError(500, "Non è stato possibile uscire. Riprova.");
  }
  return noContent();
}
