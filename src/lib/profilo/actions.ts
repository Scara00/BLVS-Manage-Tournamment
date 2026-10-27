"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { EMAIL_CHANGE_REDIRECT_PATH } from "./paths";
import { readProfiloRow, readStatoCategoria } from "./read";
import { PROFILO_MESSAGES, PROFILO_PATH, type ProfiloFormState } from "./types";
import { validaProfilo } from "./validation";

const EMAIL_TAKEN_CODES = new Set(["email_exists", "user_already_exists"]);
const RATE_LIMIT_CODES = new Set([
  "over_email_send_rate_limit",
  "over_request_rate_limit",
]);

/** `hint` raised by the trigger `utenti_blocca_categoria`. */
const TRIGGER_HINTS: Record<string, "bloccata" | "iscrizione_attiva"> = {
  categoria_bloccata: "bloccata",
  iscrizione_attiva: "iscrizione_attiva",
};

function errorState(
  fields: Extract<ProfiloFormState, { status: "error" }>["fields"],
  message: string = PROFILO_MESSAGES.invalid,
): ProfiloFormState {
  return { status: "error", message, fields };
}

async function confirmationRedirect(): Promise<string | undefined> {
  const origin = (await headers()).get("origin");
  return origin ? new URL(EMAIL_CHANGE_REDIRECT_PATH, origin).href : undefined;
}

/**
 * Saves name, surname and (while allowed) category of the signed-in player,
 * through RLS. A new email is never written here: Supabase Auth sends the
 * confirmation links (old and new address, `double_confirm_changes`) and
 * only swaps the address, and `utenti.email` with it, once both are opened.
 */
export async function aggiornaProfilo(
  _prevState: ProfiloFormState,
  formData: FormData,
): Promise<ProfiloFormState> {
  let user: CurrentUser | null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error("[profilo] verifica della sessione non riuscita", error);
    user = null;
  }
  if (!user) {
    return {
      status: "sessionExpired",
      message: PROFILO_MESSAGES.sessionExpired,
    };
  }
  const { supabase } = user;

  let row, statoCategoria;
  try {
    [row, statoCategoria] = await Promise.all([
      readProfiloRow(supabase, user.id),
      readStatoCategoria(supabase, user.id),
    ]);
  } catch (error) {
    console.error("[profilo] lettura del profilo non riuscita", error);
    return errorState({}, PROFILO_MESSAGES.failed);
  }

  const result = validaProfilo(formData, {
    categoriaAttuale: row.categoria,
    statoCategoria,
  });
  if (!result.ok) return errorState(result.fields);
  const { nome, cognome, email } = result.values;
  const categoria = result.values.categoria ?? row.categoria;

  if (
    nome !== row.nome ||
    cognome !== row.cognome ||
    categoria !== row.categoria
  ) {
    const { error } = await supabase
      .from("utenti")
      .update({ nome, cognome, categoria })
      .eq("id", user.id);
    if (error) {
      // The trigger `utenti_blocca_categoria` is the real guard: a stage
      // may have started between the read above and this write.
      const stato = error.code === "23514" && TRIGGER_HINTS[error.hint];
      if (stato) {
        return errorState({ categoria: PROFILO_MESSAGES.categoria[stato] });
      }
      console.error("[profilo] salvataggio non riuscito", error);
      return errorState({}, PROFILO_MESSAGES.failed);
    }
  }

  const emailAttuale = row.email.toLowerCase();
  let emailInAttesa: string | null = null;
  if (email !== emailAttuale) {
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: await confirmationRedirect() },
    );
    if (error) {
      revalidatePath(PROFILO_PATH);
      const altriSalvati = "Gli altri dati sono stati salvati.";
      if (error.code && EMAIL_TAKEN_CODES.has(error.code)) {
        return errorState(
          { email: PROFILO_MESSAGES.emailTaken },
          `${PROFILO_MESSAGES.invalid} ${altriSalvati}`,
        );
      }
      if (error.code && RATE_LIMIT_CODES.has(error.code)) {
        return errorState(
          { email: PROFILO_MESSAGES.emailRateLimited },
          `${PROFILO_MESSAGES.invalid} ${altriSalvati}`,
        );
      }
      if (error.code === "session_not_found" || error.status === 401) {
        return {
          status: "sessionExpired",
          message: PROFILO_MESSAGES.sessionExpired,
        };
      }
      console.error("[profilo] cambio email non riuscito", error);
      return errorState(
        { email: PROFILO_MESSAGES.emailFailed },
        `${PROFILO_MESSAGES.emailFailed} ${altriSalvati}`,
      );
    }
    emailInAttesa = email;
  }

  revalidatePath(PROFILO_PATH);
  return {
    status: "success",
    message: PROFILO_MESSAGES.saved,
    // The form keeps showing what was submitted; the active email only
    // changes once confirmed, and the profile shows it as pending.
    values: { nome, cognome, email: emailInAttesa ?? row.email, categoria },
    emailInAttesa,
  };
}
