"use server";

import { refresh } from "next/cache";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { pubblicaClassificaStagione } from "@/lib/classifica-generale/pubblica";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { now } from "@/lib/time/server-time";
import {
  ELIMINAZIONE_MESSAGES as M,
  erroreConferma,
  messaggioEliminata,
  type EliminaTappaState,
  type MotivoErroreEliminazione,
} from "./state";

type PgError = { code?: string; hint?: string | null; message?: string };

/** What `elimina_tappa()` returns. */
type EsitoEliminazione = {
  nome: string;
  stagione: number;
  in_classifica: boolean;
};

function text(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

/** Maps a database error to the reason and copy. */
function erroreDb(error: PgError): {
  reason: MotivoErroreEliminazione;
  message: string;
} {
  if (error.hint === "tappa_non_trovata") {
    return { reason: "conflict", message: M.conflict };
  }
  if (error.code === "42501") {
    return { reason: "permissionDenied", message: M.permissionDenied };
  }
  console.error("[tappe] errore del database", error);
  return { reason: "network", message: M.network };
}

/**
 * «Elimina tappa», after the admin typed ELIMINA and confirmed. RPC
 * `elimina_tappa()` deletes the stage with everything it owns, in any
 * state; when it counted for the overall standing, that season is
 * published again in live. The role is checked here and again by the RPC
 * and RLS. Without Supabase env (CI, e2e) nothing is saved: `unavailable`.
 */
export async function eliminaTappa(
  _prev: EliminaTappaState,
  formData: FormData,
): Promise<EliminaTappaState> {
  const at = now().getTime();
  const fail = (
    reason: MotivoErroreEliminazione,
    message: string,
    fields: { conferma?: string } = {},
  ): EliminaTappaState => ({ status: "error", reason, message, fields, at });

  const id = text(formData.get("tappaId"));
  const errore = erroreConferma(text(formData.get("conferma")));
  if (errore) return fail("invalid", M.invalid, { conferma: errore });
  if (!readSupabaseEnv()) return fail("unavailable", M.unavailable);

  let user: CurrentUser | null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error("[tappe] verifica della sessione non riuscita", error);
    user = null;
  }
  if (!user) return fail("sessionExpired", M.sessionExpired);
  if (user.ruolo !== "admin") {
    return fail("permissionDenied", M.permissionDenied);
  }
  if (!isUuid(id)) return fail("conflict", M.conflict);

  let esito: EsitoEliminazione;
  try {
    const { data, error } = await user.supabase.rpc("elimina_tappa", {
      p_tappa: id,
    });
    if (error) {
      const e = erroreDb(error);
      return fail(e.reason, e.message);
    }
    esito = data as EsitoEliminazione;
  } catch (error) {
    console.error("[tappe] eliminazione non riuscita", error);
    return fail("network", M.network);
  }

  // The stage is gone: from here on nothing undoes it.
  if (esito.in_classifica) {
    await pubblicaClassificaStagione(
      esito.stagione,
      `${esito.nome}: tappa eliminata`,
    );
  }
  refresh();
  return { status: "success", message: messaggioEliminata(esito.nome), at };
}
