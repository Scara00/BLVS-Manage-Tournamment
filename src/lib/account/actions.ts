"use server";

import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { loginHref } from "@/lib/navigation/auth-paths";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  CANCELLA_ACCOUNT_MESSAGES,
  messaggioCancellazione,
  type CancellaAccountState,
} from "./types";

/**
 * Deletes the signed-in player's account (BLVS-50, R-79):
 * 1. `cancella_account()` blanks the personal data and keeps the results
 *    («Giocatore anonimo» in every standing); it refuses admins and players
 *    with a stage in progress;
 * 2. the session ends on this device;
 * 3. the Auth login is deleted with the admin API (secret key). Its
 *    trigger anonymises too, so a deletion from the dashboard is the same.
 *    Without the key the login stays but is useless: `getCurrentUser()`
 *    refuses anonymised accounts.
 */
export async function cancellaAccount(
  _prevState: CancellaAccountState,
  formData: FormData,
): Promise<CancellaAccountState> {
  if (formData.get("conferma") !== "1") {
    return { status: "error", message: CANCELLA_ACCOUNT_MESSAGES.conferma };
  }

  let user: CurrentUser | null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error("[account] verifica della sessione non riuscita", error);
    user = null;
  }
  if (!user) {
    return {
      status: "sessionExpired",
      message: CANCELLA_ACCOUNT_MESSAGES.sessionExpired,
    };
  }

  const { error } = await user.supabase.rpc("cancella_account");
  if (error) {
    if (error.code !== "23514") {
      console.error("[account] cancellazione non riuscita", error);
    }
    return { status: "error", message: messaggioCancellazione(error.hint) };
  }

  const { error: signOutError } = await user.supabase.auth.signOut({
    scope: "local",
  });
  if (signOutError) {
    console.error("[account] uscita non riuscita", signOutError);
  }

  const admin = getSupabaseAdmin();
  if (admin) {
    const { error: authError } = await admin.auth.admin.deleteUser(user.id);
    if (authError) {
      console.error("[account] eliminazione del login non riuscita", authError);
    }
  } else {
    console.error(
      "[account] chiave segreta assente: il login resta, l'account è anonimo",
    );
  }

  redirect(loginHref(null, { reason: "account_cancellato" }));
}
