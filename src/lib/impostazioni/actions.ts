"use server";

import { createClient as createStatelessClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { confermaValida } from "@/lib/cancellazione/anonimo";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { newPasswordErrors } from "@/lib/auth/password-policy";
import {
  PASSWORD_UPDATED_MESSAGE,
  OTHER_SESSIONS_NOT_CLOSED_MESSAGE,
  SAME_PASSWORD_MESSAGE,
  WEAK_PASSWORD_MESSAGE,
} from "@/lib/auth/password-reset/messages";
import { checkAuthAttempt, clientIp } from "@/lib/auth/rate-limit";
import { pubblicaClassificaGenerale } from "@/lib/classifica-generale/pubblica";
import {
  DEMO_ACCOUNT_CANCELLATO_COOKIE,
  DEMO_PASSWORD_ATTUALE,
} from "@/lib/demo/impostazioni";
import { readSupabaseEnv } from "@/lib/supabase/env";
import {
  ACCOUNT_CANCELLATO_PATH,
  IMPOSTAZIONI_MESSAGES as M,
  type CambioPasswordState,
  type CampoPassword,
  type CancellazioneState,
} from "./types";

function testo(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function utenteConnesso(): Promise<CurrentUser | null> {
  try {
    return await getCurrentUser();
  } catch (error) {
    console.error("[impostazioni] verifica della sessione non riuscita", error);
    return null;
  }
}

function erroreCampi(
  fields: Partial<Record<CampoPassword, string>>,
  message: string = M.invalid,
): CambioPasswordState {
  return { status: "error", message, fields };
}

/**
 * Checks the current password without touching the user's session: a
 * throwaway client (no cookies, nothing persisted) signs in with it.
 * `true` = right, `false` = wrong, `null` = Auth could not answer.
 */
async function passwordGiusta(
  email: string,
  password: string,
): Promise<boolean | null> {
  const env = readSupabaseEnv();
  if (!env) return password === DEMO_PASSWORD_ATTUALE;
  const verifica = createStatelessClient(env.url, env.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { error } = await verifica.auth.signInWithPassword({
    email,
    password,
  });
  if (!error) {
    // Ends the session the check opened; the user's own one stays.
    await verifica.auth.signOut({ scope: "local" }).catch(() => undefined);
    return true;
  }
  if (error.code === "invalid_credentials" || error.status === 400)
    return false;
  console.error("[impostazioni] verifica della password non riuscita", error);
  return null;
}

/**
 * «Cambia password» on w-impostazioni: the current password, then the new
 * one twice (BLVS-12 rules). On success the other sessions are closed and
 * this device stays signed in, like the reset flow (BLVS-14).
 */
export async function cambiaPassword(
  _prev: CambioPasswordState,
  formData: FormData,
): Promise<CambioPasswordState> {
  const attuale = testo(formData, "attuale");
  const password = testo(formData, "password");
  const conferma = testo(formData, "conferma");

  const demo = !readSupabaseEnv();
  const user = demo ? null : await utenteConnesso();
  if (!demo && !user)
    return { status: "sessionExpired", message: M.sessionExpired };

  const fields: Partial<Record<CampoPassword, string>> = {
    ...(attuale ? {} : { attuale: M.attualeMancante }),
    ...newPasswordErrors(password, conferma),
  };
  if (attuale && password && attuale === password)
    fields.password = SAME_PASSWORD_MESSAGE;
  if (Object.keys(fields).length > 0) return erroreCampi(fields);

  const check = await checkAuthAttempt(
    clientIp({ headers: await headers() }),
    "password-change",
    user?.email ?? null,
  );
  if (check.status === "unavailable") return erroreCampi({}, M.unavailable);
  if (check.status === "blocked") return erroreCampi({}, M.rateLimited);

  const giusta = await passwordGiusta(user?.email ?? "", attuale);
  if (giusta === null) return erroreCampi({}, M.passwordFallita);
  if (!giusta) return erroreCampi({ attuale: M.attualeErrata });

  if (!user) return { status: "success", message: PASSWORD_UPDATED_MESSAGE };

  const { error } = await user.supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password")
      return erroreCampi({ password: SAME_PASSWORD_MESSAGE });
    if (error.code === "weak_password")
      return erroreCampi({ password: WEAK_PASSWORD_MESSAGE });
    console.error("[impostazioni] cambio della password non riuscito", error);
    return erroreCampi({}, M.passwordFallita);
  }

  const { error: signOutError } = await user.supabase.auth.signOut({
    scope: "others",
  });
  if (signOutError) {
    console.error("[impostazioni] chiusura delle altre sessioni", signOutError);
    return { status: "success", message: OTHER_SESSIONS_NOT_CLOSED_MESSAGE };
  }
  return { status: "success", message: PASSWORD_UPDATED_MESSAGE };
}

type EsitoCancellazione = { tappe: string[]; ritirate: number };

/**
 * «Cancella l'account» on w-elimina-account, after the player typed
 * ELIMINA and confirmed the dialog. RPC `cancella_account()` deletes the
 * account and, by cascade, every registration and result of the player in
 * one transaction; then this device signs out, the overall standings of
 * the player's seasons are published again without them and the player
 * lands on w-account-eliminato.
 */
export async function cancellaAccount(
  _prev: CancellazioneState,
  formData: FormData,
): Promise<CancellazioneState> {
  const conferma = testo(formData, "conferma");
  if (!confermaValida(conferma)) {
    return {
      status: "error",
      message: M.invalid,
      fields: {
        conferma: conferma.trim() ? M.confermaErrata : M.confermaMancante,
      },
    };
  }

  if (!readSupabaseEnv()) {
    (await cookies()).set(DEMO_ACCOUNT_CANCELLATO_COOKIE, "1", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
    redirect(ACCOUNT_CANCELLATO_PATH);
  }

  const user = await utenteConnesso();
  if (!user) return { status: "sessionExpired", message: M.sessionExpired };

  const { data, error } = await user.supabase.rpc("cancella_account");
  if (error) {
    // BLVS-50 rules: never an admin, never during a stage in progress.
    if (error.hint === "account_admin")
      return { status: "error", message: M.accountAdmin, fields: {} };
    if (error.hint === "tappa_in_corso")
      return { status: "error", message: M.tappaInCorso, fields: {} };
    if (error.hint === "gia_cancellato") {
      await user.supabase.auth.signOut({ scope: "local" });
      redirect(ACCOUNT_CANCELLATO_PATH);
    }
    console.error("[impostazioni] cancellazione dell'account", error);
    return { status: "error", message: M.cancellazioneFallita, fields: {} };
  }

  // The Auth user is gone: this only clears the session cookies.
  const { error: signOutError } = await user.supabase.auth.signOut({
    scope: "local",
  });
  if (signOutError)
    console.error("[impostazioni] uscita dopo la cancellazione", signOutError);

  const esito = data as EsitoCancellazione | null;
  for (const tappaId of esito?.tappe ?? []) {
    await pubblicaClassificaGenerale(tappaId, "Classifica aggiornata");
  }

  redirect(ACCOUNT_CANCELLATO_PATH);
}
