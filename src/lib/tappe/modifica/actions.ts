"use server";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { readTappaModificaRow } from "./read";
import {
  CAMPO_POSTI_MODIFICA,
  STATI_NON_MODIFICABILI,
  TAPPA_MODIFICA_MESSAGES as M,
  maxSottoIscrittiMessage,
  tappaModificaPath,
  type TappaModifica,
  type TappaModificaFieldErrors,
  type TappaModificaFormState,
} from "./types";
import { validaTappaModifica } from "./validation";

function errorState(
  fields: TappaModificaFieldErrors,
  message: string = M.invalid,
): TappaModificaFormState {
  return { status: "error", message, fields };
}

/** Field errors for the `check_violation` hints of `modifica_tappa`. */
const HINT_FIELDS: Record<string, TappaModificaFieldErrors> = {
  data_passata: { data: M.dataPassata },
  scadenza_passata: { scadenza: M.scadenzaPassata },
  scadenza_dopo_tappa: { scadenza: M.scadenzaDopoTappa },
  scadenza_mancante: { scadenza: M.scadenzaPassata },
};

/** Field errors for table constraints (BLVS-07, BLVS-19). */
const CONSTRAINT_FIELDS: Record<string, TappaModificaFieldErrors> = {
  tappe_finestra_iscrizioni: { scadenza: M.scadenzaPrimaApertura },
  tappe_scadenza_prima_della_tappa: { scadenza: M.scadenzaDopoTappa },
};

/** `detail` of `posti_sotto_iscritti` is `<categoria>:<iscritti>`. */
function postiSottoIscritti(detail: string): TappaModificaFieldErrors | null {
  const match = /^([MF]):(\d+)$/.exec(detail);
  if (!match) return null;
  const categoria = match[1] as "M" | "F";
  return {
    [CAMPO_POSTI_MODIFICA[categoria]]: maxSottoIscrittiMessage(
      Number(match[2]),
    ),
  };
}

async function conflict(
  supabase: SupabaseClient,
  id: string,
): Promise<TappaModificaFormState> {
  const tappa = await readTappaModificaRow(supabase, id);
  if (!tappa) return errorState({}, M.notFound);
  return { status: "conflict", message: M.conflict, tappa };
}

function rpcErrorState(error: PostgrestError): TappaModificaFormState | null {
  if (error.code === "42501") {
    return { status: "permissionDenied", message: M.permissionDenied };
  }
  if (error.code === "P0002") return errorState({}, M.notFound);
  if (error.code !== "23514") return null;
  if (error.hint === "tappa_non_modificabile") {
    return { status: "nonModificabile", message: M.nonModificabile };
  }
  if (error.hint === "posti_sotto_iscritti") {
    const fields = postiSottoIscritti(error.details ?? "");
    if (fields) return errorState(fields);
  }
  const byHint = error.hint ? HINT_FIELDS[error.hint] : undefined;
  if (byHint) return errorState(byHint);
  const constraint = Object.keys(CONSTRAINT_FIELDS).find((name) =>
    error.message.includes(name),
  );
  return constraint ? errorState(CONSTRAINT_FIELDS[constraint]) : null;
}

/**
 * Saves w-admin-tappa-modifica through the `modifica_tappa` RPC (RLS as
 * the admin). The form sends back the `versione` it was loaded with: if
 * someone saved in between, nothing is written and the form gets the
 * current data (`conflict`). A maximum below a board's active
 * registrations is refused here and by the DB trigger.
 */
export async function aggiornaTappa(
  _prevState: TappaModificaFormState,
  formData: FormData,
): Promise<TappaModificaFormState> {
  if (!readSupabaseEnv()) {
    return { status: "unavailable", message: M.unavailable };
  }

  let user: CurrentUser | null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error("[tappe] verifica della sessione non riuscita", error);
    user = null;
  }
  if (!user) return { status: "sessionExpired", message: M.sessionExpired };
  if (user.ruolo !== "admin") {
    return { status: "permissionDenied", message: M.permissionDenied };
  }
  const { supabase } = user;

  const id = String(formData.get("id") ?? "");
  const versione = Number(formData.get("versione"));

  let originale: TappaModifica | null;
  try {
    originale = await readTappaModificaRow(supabase, id);
  } catch (error) {
    console.error("[tappe] lettura della tappa non riuscita", error);
    return errorState({}, M.failed);
  }
  if (!originale) return errorState({}, M.notFound);
  if (!Number.isInteger(versione) || versione !== originale.versione) {
    return { status: "conflict", message: M.conflict, tappa: originale };
  }
  if (STATI_NON_MODIFICABILI.includes(originale.stato)) {
    return { status: "nonModificabile", message: M.nonModificabile };
  }

  const result = validaTappaModifica(formData, originale);
  if (!result.ok) return errorState(result.fields);
  const v = result.values;

  const { data, error } = await supabase.rpc("modifica_tappa", {
    p_id: id,
    p_versione: versione,
    p_nome: v.nome,
    p_luogo: v.luogo,
    p_data: v.data,
    p_scadenza: v.scadenza,
    p_posti_m: v.postiM,
    p_posti_f: v.postiF,
  });
  if (error) {
    // Someone saved between our read and the RPC.
    if (error.code === "40001") {
      try {
        return await conflict(supabase, id);
      } catch (readError) {
        console.error(
          "[tappe] rilettura dopo il conflitto non riuscita",
          readError,
        );
        return errorState({}, M.failed);
      }
    }
    const state = rpcErrorState(error);
    if (state) return state;
    console.error("[tappe] salvataggio non riuscito", error);
    return errorState({}, M.failed);
  }

  revalidatePath(tappaModificaPath(id));
  revalidatePath("/admin/tappe");
  let salvata: TappaModifica | null = null;
  try {
    salvata = await readTappaModificaRow(supabase, id);
  } catch (readError) {
    console.error(
      "[tappe] rilettura dopo il salvataggio non riuscita",
      readError,
    );
  }
  return {
    status: "success",
    message: M.saved,
    tappa: salvata ?? {
      ...originale,
      nome: v.nome,
      luogo: v.luogo,
      data: v.data,
      scadenza: String(formData.get("scadenza") ?? ""),
      versione: Number(data),
      tabelloni: {
        M: { ...originale.tabelloni.M, posti: v.postiM },
        F: { ...originale.tabelloni.F, posti: v.postiF },
      },
    },
  };
}
