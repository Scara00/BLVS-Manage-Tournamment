import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EMAIL_NOT_CONFIRMED_MESSAGE } from "@/lib/auth/email-verification/constants";
import type { Iscrizione } from "@/lib/db/types";
import {
  ALREADY_REGISTERED_MESSAGE,
  ISCRIZIONE_NON_RIUSCITA_MESSAGE,
  ISCRIZIONI_CHIUSE_MESSAGE,
  ISCRIZIONI_SCADUTE_MESSAGE,
  NO_CATEGORY_MESSAGE,
  POSTI_ESAURITI_MESSAGE,
  STAGE_ARCHIVED_MESSAGE,
  STAGE_CANCELLED_MESSAGE,
  TAPPA_ANNULLATA_MESSAGE,
  TAPPA_NON_TROVATA_MESSAGE,
} from "./messages";
import type { MotivoBlocco } from "./motivo";

export type IscrizioneCreata = Pick<
  Iscrizione,
  | "id"
  | "tappa_id"
  | "tabellone_id"
  | "utente_id"
  | "stato"
  | "posto"
  | "created_at"
>;

export type MotivoRifiuto =
  MotivoBlocco | "email_non_confermata" | "non_trovata";

export type EsitoIscrizione =
  | { ok: true; iscrizione: IscrizioneCreata }
  | { ok: false; status: number; message: string; motivo?: MotivoRifiuto };

type DbError = { code?: string; message?: string; hint?: string | null };

const PER_HINT: Record<string, { motivo: MotivoRifiuto; message: string }> = {
  gia_iscritto: { motivo: "gia_iscritto", message: ALREADY_REGISTERED_MESSAGE },
  posti_esauriti: { motivo: "esaurite", message: POSTI_ESAURITI_MESSAGE },
  chiuse: { motivo: "chiuse", message: ISCRIZIONI_CHIUSE_MESSAGE },
  scadute: { motivo: "scadute", message: ISCRIZIONI_SCADUTE_MESSAGE },
  annullata: { motivo: "annullata", message: TAPPA_ANNULLATA_MESSAGE },
  // BLVS-22: trigger `iscrizioni_blocca_tappa_chiusa` on the RPC's insert.
  tappa_annullata: { motivo: "annullata", message: STAGE_CANCELLED_MESSAGE },
  tappa_archiviata: { motivo: "chiuse", message: STAGE_ARCHIVED_MESSAGE },
  categoria_mancante: {
    motivo: "categoria_mancante",
    message: NO_CATEGORY_MESSAGE,
  },
};

/** Maps an error of RPC `iscriviti_tappa()` onto status, message and reason. */
export function esitoDaErrore(error: DbError): EsitoIscrizione {
  const known = error.hint ? PER_HINT[error.hint] : undefined;
  if (known) {
    const status = known.motivo === "categoria_mancante" ? 422 : 409;
    return { ok: false, status, ...known };
  }
  switch (error.code) {
    case "23505":
      return {
        ok: false,
        status: 409,
        motivo: "gia_iscritto",
        message: ALREADY_REGISTERED_MESSAGE,
      };
    case "P0002":
      return {
        ok: false,
        status: 404,
        motivo: "non_trovata",
        message: TAPPA_NON_TROVATA_MESSAGE,
      };
    case "42501":
      if (error.message?.startsWith("Conferma"))
        return {
          ok: false,
          status: 403,
          motivo: "email_non_confermata",
          message: EMAIL_NOT_CONFIRMED_MESSAGE,
        };
      // RLS refusal without a trigger message: the stage is not open.
      return {
        ok: false,
        status: 409,
        motivo: "chiuse",
        message: ISCRIZIONI_CHIUSE_MESSAGE,
      };
    default:
      console.error("[iscrizioni] iscrizione non riuscita", error);
      return {
        ok: false,
        status: 500,
        message: ISCRIZIONE_NON_RIUSCITA_MESSAGE,
      };
  }
}

/**
 * The signed-in player takes the first free seat of their board. Every rule
 * (stage open, deadline, seats, one registration per stage, confirmed
 * email) is enforced by the database inside one transaction with a lock on
 * the board; this only turns the outcome into a status and a message.
 * Shared by `POST /api/iscrizioni` and the «Prendi il posto» action.
 */
export async function iscriviGiocatore(
  supabase: SupabaseClient,
  tappaId: string,
): Promise<EsitoIscrizione> {
  const { data: confermata, error: checkError } =
    await supabase.rpc("email_confermata");
  if (checkError) return esitoDaErrore(checkError);
  if (confermata !== true)
    return {
      ok: false,
      status: 403,
      motivo: "email_non_confermata",
      message: EMAIL_NOT_CONFIRMED_MESSAGE,
    };

  const { data, error } = await supabase
    .rpc("iscriviti_tappa", { p_tappa: tappaId })
    .select("id, tappa_id, tabellone_id, utente_id, stato, posto, created_at")
    .single<IscrizioneCreata>();
  if (error) return esitoDaErrore(error);
  return { ok: true, iscrizione: data };
}
