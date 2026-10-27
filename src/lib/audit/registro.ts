import type { SupabaseClient } from "@supabase/supabase-js";
import { formatServerTime } from "@/lib/time/server-time";
import type { TipoEventoRegistro } from "./eventi";

/** JSON value stored as "valore prima" / "valore dopo". */
export type ValoreRegistro =
  | string
  | number
  | boolean
  | null
  | ValoreRegistro[]
  | { [key: string]: ValoreRegistro };

export type NuovoEventoRegistro = {
  tipo: TipoEventoRegistro;
  /** Table or domain object the event is about, e.g. "punteggi". */
  entita: string;
  entitaId: string;
  valorePrima?: ValoreRegistro;
  valoreDopo?: ValoreRegistro;
  nota?: string;
  /**
   * Author, only for calls with the secret key (no JWT). With a user session
   * the database always records `auth.uid()` and ignores this.
   */
  attoreId?: string;
};

/** A row of `public.registro` written by `registra_evento()`. */
export type VoceRegistro = {
  id: number;
  tipo: TipoEventoRegistro;
  attore_id: string;
  entita: string;
  entita_id: string;
  valore_prima: ValoreRegistro | null;
  valore_dopo: ValoreRegistro | null;
  nota: string | null;
  /** ISO instant (UTC); show it with `formatOraRegistro`. */
  created_at: string;
};

export class ErroreRegistro extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ErroreRegistro";
  }
}

/**
 * Appends an event to the race log. The log is append-only: there is no
 * update or delete here, and the database rejects both. A correction is a
 * new event (`correzione_punteggio`) with the previous and the new value.
 */
export async function registraEvento(
  client: SupabaseClient,
  evento: NuovoEventoRegistro,
): Promise<VoceRegistro> {
  const { data, error } = await client
    .rpc("registra_evento", {
      p_tipo: evento.tipo,
      p_entita: evento.entita,
      p_entita_id: evento.entitaId,
      p_valore_prima: evento.valorePrima ?? null,
      p_valore_dopo: evento.valoreDopo ?? null,
      p_nota: evento.nota ?? null,
      p_attore_id: evento.attoreId ?? null,
    })
    .single<VoceRegistro>();

  if (error || !data) {
    console.error("[registro] scrittura non riuscita", error);
    throw new ErroreRegistro(
      "Non è stato possibile scrivere l'evento nel registro.",
      error?.code,
    );
  }
  return data;
}

/** Date and time of a log entry in Europe/Rome, e.g. "27/10/26, 10:15:03". */
export function formatOraRegistro(voce: Pick<VoceRegistro, "created_at">) {
  return formatServerTime(new Date(voce.created_at));
}
