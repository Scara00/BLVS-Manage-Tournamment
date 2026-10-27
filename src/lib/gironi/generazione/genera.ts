import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FORBIDDEN_MESSAGE } from "@/lib/api/responses";
import {
  GENERAZIONE_NON_RIUSCITA_MESSAGE,
  ISCRIZIONI_NON_CHIUSE_MESSAGE,
  PARTITE_INIZIATE_MESSAGE,
  TAPPA_ARCHIVIATA_MESSAGE,
  TAPPA_NON_TROVATA_MESSAGE,
} from "./messages";
import type { GironiGenerati } from "./types";

export type MotivoRifiutoGironi =
  | "iscrizioni_non_chiuse"
  | "partite_iniziate"
  | "tappa_archiviata"
  | "non_trovata"
  | "negato"
  | "errore";

export type EsitoGenerazione =
  | { ok: true; categorie: GironiGenerati[] }
  | {
      ok: false;
      status: number;
      motivo: MotivoRifiutoGironi;
      message: string;
    };

type DbError = { code?: string; message?: string; hint?: string | null };

const PER_HINT: Record<
  string,
  { motivo: MotivoRifiutoGironi; message: string }
> = {
  iscrizioni_non_chiuse: {
    motivo: "iscrizioni_non_chiuse",
    message: ISCRIZIONI_NON_CHIUSE_MESSAGE,
  },
  partite_iniziate: {
    motivo: "partite_iniziate",
    message: PARTITE_INIZIATE_MESSAGE,
  },
  tappa_archiviata: {
    motivo: "tappa_archiviata",
    message: TAPPA_ARCHIVIATA_MESSAGE,
  },
};

/** Maps an error of RPC `genera_gironi()` onto status, message and reason. */
export function esitoGenerazioneDaErrore(error: DbError): EsitoGenerazione {
  const known = error.hint ? PER_HINT[error.hint] : undefined;
  if (known) return { ok: false, status: 409, ...known };
  switch (error.code) {
    case "P0002":
      return {
        ok: false,
        status: 404,
        motivo: "non_trovata",
        message: TAPPA_NON_TROVATA_MESSAGE,
      };
    case "42501":
      return {
        ok: false,
        status: 403,
        motivo: "negato",
        message: FORBIDDEN_MESSAGE,
      };
    default:
      console.error("[gironi] generazione non riuscita", error);
      return {
        ok: false,
        status: 500,
        motivo: "errore",
        message: GENERAZIONE_NON_RIUSCITA_MESSAGE,
      };
  }
}

/**
 * Draws the groups of both boards of a closed stage and creates their 3
 * matches each. Every rule (admin only, registrations closed, no match
 * started yet when regenerating) is enforced by the database in one
 * transaction; this only turns the outcome into a status and a message.
 */
export async function generaGironi(
  supabase: SupabaseClient,
  tappaId: string,
): Promise<EsitoGenerazione> {
  const { data, error } = await supabase.rpc("genera_gironi", {
    p_tappa: tappaId,
  });
  if (error) return esitoGenerazioneDaErrore(error);
  return { ok: true, categorie: (data ?? []) as GironiGenerati[] };
}
