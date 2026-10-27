"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import {
  annullaPunteggioDemo,
  classificaDemo,
  getDemoPunteggi,
  punteggioUfficialeDemo,
  salvaPunteggioDemo,
} from "@/lib/demo/punteggi";
import { leggiClassificaGirone } from "@/lib/gironi/classifica";
import {
  publishGroupStandings,
  publishPendingScores,
  publishScore,
} from "@/lib/live/publish";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { now } from "@/lib/time/server-time";
import type { PunteggioUfficiale } from "./conflitto/rileva";
import { leggiPunteggi } from "./dati";
import {
  contaDaInserire,
  nomiGiocatori,
  toGroupStandings,
  toLiveMatch,
} from "./format";
import {
  PUNTEGGIO_MESSAGES,
  type AnnullaInput,
  type AnnullaState,
  type MotivoErrore,
  type PunteggioState,
} from "./state";
import {
  messaggioCodice,
  validaPunteggio,
  type CodiceErrore,
} from "./validazione";

type PgError = { code?: string; hint?: string | null; message?: string };

type Sessione =
  | { ok: true; supabase: SupabaseClient | null }
  | { ok: false; reason: "sessionExpired" | "permissionDenied" };

/** Admin role checked on the server; the RPCs check it again. */
async function sessioneAdmin(): Promise<Sessione> {
  if (!readSupabaseEnv()) return { ok: true, supabase: null };
  let user: CurrentUser | null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error("[punteggi] verifica della sessione non riuscita", error);
    user = null;
  }
  if (!user) return { ok: false, reason: "sessionExpired" };
  if (user.ruolo !== "admin") return { ok: false, reason: "permissionDenied" };
  return { ok: true, supabase: user.supabase };
}

const CODICI: readonly string[] = [
  "valori_non_validi",
  "pareggio",
  "regola_set",
] satisfies CodiceErrore[];

type Esito =
  | { ok: true; versione: number; tipo: "inserimento" | "correzione" }
  | { ok: false; reason: MotivoErrore; message: string }
  | { ok: false; codice: CodiceErrore };

function errore(reason: MotivoErrore, message?: string) {
  return {
    ok: false as const,
    reason,
    message: message ?? PUNTEGGIO_MESSAGES[reason],
  };
}

function erroreComune(error: PgError) {
  if (error.code === "42501") return errore("permissionDenied");
  switch (error.hint) {
    case "versione_superata":
      return errore("conflict");
    case "punteggio_cambiato":
      return errore("conflict", PUNTEGGIO_MESSAGES.annullamentoCambiato);
    case "annullamento_scaduto":
      return errore("annullamentoScaduto");
    case "partita_non_giocabile":
    case "tappa_archiviata":
    case "tappa_annullata":
      return errore("nonGiocabile");
  }
  if (error.code === "P0002") return errore("nonGiocabile");
  return null;
}

async function salvaDb(
  supabase: SupabaseClient,
  partitaId: string,
  versione: number,
  a: number,
  b: number,
  sovrascrivi: boolean,
): Promise<Esito> {
  if (!isUuid(partitaId)) return errore("nonGiocabile");
  // «Sovrascrivi» (BLVS-34): `versione` is the one shown in the conflict
  // dialog; the RPC refuses it again if another save landed since.
  const { data, error } = sovrascrivi
    ? await supabase.rpc("sovrascrivi_punteggio", {
        p_partita: partitaId,
        p_versione_vista: versione,
        p_a: a,
        p_b: b,
      })
    : await supabase.rpc("salva_punteggio", {
        p_partita: partitaId,
        p_versione: versione,
        p_a: a,
        p_b: b,
      });
  if (error) {
    if (error.hint && CODICI.includes(error.hint)) {
      return { ok: false, codice: error.hint as CodiceErrore };
    }
    const comune = erroreComune(error);
    if (comune) return comune;
    throw error;
  }
  const row = (data as { versione: number; tipo: string }[])[0];
  return {
    ok: true,
    versione: row.versione,
    tipo: row.tipo === "correzione_punteggio" ? "correzione" : "inserimento",
  };
}

function salvaDemo(
  tappaId: string,
  partitaId: string,
  versione: number,
  a: number,
  b: number,
  at: number,
): Esito {
  const esito = salvaPunteggioDemo(tappaId, partitaId, versione, { a, b }, at);
  switch (esito.status) {
    case "ok":
      return { ok: true, versione: esito.versione, tipo: esito.tipo };
    case "nonValido":
      return { ok: false, codice: esito.codice };
    case "versioneSuperata":
      return errore("conflict");
    default:
      return errore("nonGiocabile");
  }
}

type UfficialeRow = {
  versione: number;
  sets: PunteggioUfficiale["sets"] | null;
  autore: string | null;
  aggiornato_il: string | null;
};

/**
 * The official score after a refused save (BLVS-34), for the conflict
 * dialog. Null when it cannot be read: the screen then asks to reload.
 */
async function leggiUfficiale(
  supabase: SupabaseClient | null,
  tappaId: string,
  partitaId: string,
): Promise<PunteggioUfficiale | null> {
  try {
    if (!supabase) return punteggioUfficialeDemo(tappaId, partitaId);
    const { data, error } = await supabase.rpc("punteggio_attuale", {
      p_partita: partitaId,
    });
    if (error) throw error;
    const row = (data as UfficialeRow[])[0];
    if (!row) return null;
    return {
      versione: row.versione,
      sets: row.sets ?? [],
      autore: row.autore,
      salvatoIl: row.aggiornato_il,
    };
  } catch (error) {
    console.error(
      "[punteggi] lettura del punteggio ufficiale non riuscita",
      error,
    );
    return null;
  }
}

/**
 * Tells the live pages (R-68: within 5 s): the match, the group standing
 * recomputed from the saved scores (BLVS-27) and the stage's count of
 * results to enter. A failure here never undoes the save.
 */
async function pubblica(
  supabase: SupabaseClient | null,
  tappaId: string,
  partitaId: string,
) {
  try {
    const elenco = supabase
      ? await leggiPunteggi(supabase, tappaId)
      : getDemoPunteggi(tappaId);
    const partita = elenco?.partite.find((p) => p.id === partitaId);
    if (!elenco || !partita) return;
    publishScore(toLiveMatch(partita, tappaId));

    const classifica = supabase
      ? await leggiClassificaGirone(supabase, partita.gironeId)
      : classificaDemo(tappaId, partita.gironeId);
    if (classifica) {
      const delGirone = elenco.partite.filter(
        (p) => p.gironeId === partita.gironeId,
      );
      publishGroupStandings(
        toGroupStandings(
          { id: partita.gironeId, nome: partita.gironeNome },
          classifica,
          nomiGiocatori(delGirone),
          { stageId: tappaId, category: partita.categoria },
        ),
      );
    }
    publishPendingScores({
      id: tappaId,
      label: elenco.tappa.nome,
      count: contaDaInserire(elenco.partite),
    });
  } catch (error) {
    console.error("[punteggi] pubblicazione live non riuscita", error);
  }
}

/**
 * Saves the single set of a group match (R-31, R-32): the same checks as
 * the form, then `salva_punteggio`, which checks them again, concludes the
 * match and writes the registro. The live pages get the new score and
 * standing right after.
 */
export async function salvaPunteggio(
  _prev: PunteggioState,
  formData: FormData,
): Promise<PunteggioState> {
  const at = now().getTime();
  const sessione = await sessioneAdmin();
  if (!sessione.ok) {
    return {
      status: "error",
      reason: sessione.reason,
      message: PUNTEGGIO_MESSAGES[sessione.reason],
      at,
    };
  }

  const tappaId = String(formData.get("tappaId") ?? "");
  const partitaId = String(formData.get("partitaId") ?? "");
  const versione = Number(formData.get("versione"));
  const sovrascrivi = formData.get("sovrascrivi") === "1";
  const verifica = validaPunteggio({
    a: String(formData.get("puntiA") ?? ""),
    b: String(formData.get("puntiB") ?? ""),
  });
  if (!tappaId || !partitaId || !Number.isInteger(versione)) {
    return {
      status: "error",
      reason: "nonGiocabile",
      message: PUNTEGGIO_MESSAGES.nonGiocabile,
      at,
    };
  }
  if (!verifica.valido) {
    return {
      status: "fieldErrors",
      campi: verifica.campi,
      punteggio: verifica.punteggio,
      message: PUNTEGGIO_MESSAGES.fieldErrors,
      at,
    };
  }
  const a = verifica.punti.a as number;
  const b = verifica.punti.b as number;

  let esito: Esito;
  try {
    esito = sessione.supabase
      ? await salvaDb(sessione.supabase, partitaId, versione, a, b, sovrascrivi)
      : salvaDemo(tappaId, partitaId, versione, a, b, at);
  } catch (error) {
    console.error("[punteggi] salvataggio non riuscito", error);
    esito = errore("network");
  }

  if (!esito.ok) {
    if ("reason" in esito && esito.reason === "conflict") {
      // Never overwritten silently: the admin chooses in the dialog.
      const salvato = await leggiUfficiale(
        sessione.supabase,
        tappaId,
        partitaId,
      );
      if (salvato) {
        return {
          status: "conflict",
          salvato,
          mio: { a, b },
          message: PUNTEGGIO_MESSAGES.conflitto,
          at,
        };
      }
    }
    if ("codice" in esito) {
      return {
        status: "fieldErrors",
        campi: {},
        punteggio: messaggioCodice(esito.codice, a, b),
        message: PUNTEGGIO_MESSAGES.fieldErrors,
        at,
      };
    }
    return {
      status: "error",
      reason: esito.reason,
      message: esito.message,
      at,
    };
  }

  await pubblica(sessione.supabase, tappaId, partitaId);
  refresh();
  return {
    status: "success",
    partitaId,
    versione: esito.versione,
    punteggio: { a, b },
    tipo: esito.tipo,
    message:
      esito.tipo === "correzione"
        ? PUNTEGGIO_MESSAGES.corretto
        : PUNTEGGIO_MESSAGES.salvato,
    at,
  };
}

/**
 * «Annulla» from the toast (R-35): puts back the score and state the
 * match had before the save, if nobody changed it since and the window
 * is still open. Written in the registro and published like a save.
 */
export async function annullaPunteggio(
  input: AnnullaInput,
): Promise<AnnullaState> {
  const at = now().getTime();
  const sessione = await sessioneAdmin();
  if (!sessione.ok) {
    return {
      status: "error",
      reason: sessione.reason,
      message: PUNTEGGIO_MESSAGES[sessione.reason],
    };
  }
  const { tappaId, partitaId, versione } = input;

  let esito: { ok: true } | ReturnType<typeof errore>;
  try {
    if (sessione.supabase) {
      if (!isUuid(partitaId)) {
        esito = errore("nonGiocabile");
      } else {
        const { error } = await sessione.supabase.rpc("annulla_punteggio", {
          p_partita: partitaId,
          p_versione: versione,
        });
        if (error) {
          const comune = erroreComune(error);
          if (!comune) throw error;
          esito = comune;
        } else {
          esito = { ok: true };
        }
      }
    } else {
      const demo = annullaPunteggioDemo(tappaId, partitaId, versione, at);
      esito =
        demo.status === "ok"
          ? { ok: true }
          : demo.status === "scaduto"
            ? errore("annullamentoScaduto")
            : demo.status === "cambiato"
              ? errore("conflict", PUNTEGGIO_MESSAGES.annullamentoCambiato)
              : errore("nonGiocabile");
    }
  } catch (error) {
    console.error("[punteggi] annullamento non riuscito", error);
    esito = errore("network", PUNTEGGIO_MESSAGES.networkAnnulla);
  }

  if (!esito.ok) {
    return { status: "error", reason: esito.reason, message: esito.message };
  }
  await pubblica(sessione.supabase, tappaId, partitaId);
  refresh();
  return { status: "success", message: PUNTEGGIO_MESSAGES.annullato };
}
