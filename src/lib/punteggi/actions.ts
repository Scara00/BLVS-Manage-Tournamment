"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import {
  annullaPunteggioDemo,
  classificaDemo,
  getDemoPunteggi,
  parzialeAttualeDemo,
  punteggioUfficialeDemo,
  salvaParzialeDemo,
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
import { leggiNoteAssenze } from "@/lib/ritiri/read";
import { pubblicaTabellone } from "@/lib/tappe/live-admin/pubblica";
import type { PunteggioUfficiale } from "./conflitto/rileva";
import {
  erroreConferma,
  messaggioImpattoCambiato,
  toImpattoFase,
  type PartitaSuccessivaRow,
} from "./correzione/format";
import {
  SCELTE_IMPATTO,
  type ImpattoFase,
  type SceltaImpatto,
} from "./correzione/types";
import { leggiPunteggi } from "./dati";
import {
  PARZIALE_MESSAGES,
  parzialeComeUfficiale,
  validaParziale,
  type MotivoErroreParziale,
  type ParzialeState,
} from "./parziale";
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
  | {
      ok: true;
      versione: number;
      tipo: "inserimento" | "correzione";
      scelta: SceltaImpatto | null;
      punteggiPersi: number;
    }
  | { ok: false; reason: MotivoErrore; message: string }
  | { ok: false; codice: CodiceErrore }
  /** BLVS-41: the next phase exists; `motivo` says why it was refused. */
  | {
      ok: false;
      impatto: ImpattoFase | null;
      motivo: "richiesto" | "conferma" | "cambiato";
    };

type OpzioniImpatto = {
  scelta: SceltaImpatto | null;
  conferma: boolean;
  attesi: number | null;
};

const MOTIVI_IMPATTO: Record<string, "richiesto" | "conferma" | "cambiato"> = {
  impatto_richiesto: "richiesto",
  conferma_richiesta: "conferma",
  punteggi_cambiati: "cambiato",
};

/** The next phase a correction would affect (`fase_successiva_correzione`). */
async function leggiImpatto(
  supabase: SupabaseClient,
  partitaId: string,
): Promise<ImpattoFase | null> {
  try {
    const { data, error } = await supabase.rpc("fase_successiva_correzione", {
      p_partita: partitaId,
    });
    if (error) throw error;
    return toImpattoFase((data ?? []) as PartitaSuccessivaRow[]);
  } catch (error) {
    console.error(
      "[punteggi] lettura della fase successiva non riuscita",
      error,
    );
    return null;
  }
}

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
  opzioni: OpzioniImpatto,
): Promise<Esito> {
  if (!isUuid(partitaId)) return errore("nonGiocabile");
  // `correggi_punteggio` (BLVS-41) wraps `salva_punteggio` unchanged and
  // waits for «Mantieni»/«Rigenera» when the next phase already exists.
  // «Sovrascrivi» (BLVS-34): `versione` is the one shown in the conflict
  // dialog; the RPC refuses it again if another save landed since.
  const { data, error } = await supabase.rpc("correggi_punteggio", {
    p_partita: partitaId,
    p_versione: versione,
    p_a: a,
    p_b: b,
    p_scelta: opzioni.scelta,
    p_conferma: opzioni.conferma,
    p_attesi: opzioni.attesi,
    p_sovrascrivi: sovrascrivi,
  });
  if (error) {
    if (error.hint && CODICI.includes(error.hint)) {
      return { ok: false, codice: error.hint as CodiceErrore };
    }
    const motivo = error.hint ? MOTIVI_IMPATTO[error.hint] : undefined;
    if (motivo) {
      return {
        ok: false,
        motivo,
        impatto: await leggiImpatto(supabase, partitaId),
      };
    }
    const comune = erroreComune(error);
    if (comune) return comune;
    throw error;
  }
  const row = (
    data as {
      versione: number;
      tipo: string;
      scelta: string | null;
      punteggi_persi: number | null;
    }[]
  )[0];
  return {
    ok: true,
    versione: row.versione,
    tipo: row.tipo === "correzione_punteggio" ? "correzione" : "inserimento",
    scelta: parseScelta(row.scelta),
    punteggiPersi: Number(row.punteggi_persi ?? 0),
  };
}

function parseScelta(value: unknown): SceltaImpatto | null {
  return SCELTE_IMPATTO.includes(value as SceltaImpatto)
    ? (value as SceltaImpatto)
    : null;
}

function salvaDemo(
  tappaId: string,
  partitaId: string,
  versione: number,
  a: number,
  b: number,
  at: number,
  opzioni: OpzioniImpatto,
): Esito {
  const esito = salvaPunteggioDemo(
    tappaId,
    partitaId,
    versione,
    { a, b },
    at,
    opzioni,
  );
  switch (esito.status) {
    case "ok":
      return {
        ok: true,
        versione: esito.versione,
        tipo: esito.tipo,
        scelta: esito.scelta,
        punteggiPersi: esito.punteggiPersi,
      };
    case "nonValido":
      return { ok: false, codice: esito.codice };
    case "impatto":
      return { ok: false, motivo: "richiesto", impatto: esito.impatto };
    case "confermaRichiesta":
      return { ok: false, motivo: "conferma", impatto: esito.impatto };
    case "impattoCambiato":
      return { ok: false, motivo: "cambiato", impatto: esito.impatto };
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
  cambio: string | null = null,
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
          // BLVS-42: a withdrawal stays visible as text after any save.
          await leggiNoteAssenze(supabase, tappaId, partita.categoria),
        ),
      );
    }
    publishPendingScores({
      id: tappaId,
      label: elenco.tappa.nome,
      count: contaDaInserire(elenco.partite),
    });
    // w-admin-live (BLVS-31) shows the board's matches, next phase too.
    await pubblicaTabellone({ supabase }, tappaId, partita.categoria, cambio);
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
  // BLVS-41: the choice made in the impact dialog, sent with the values.
  const attesiRaw = formData.get("attesi");
  const opzioni: OpzioniImpatto = {
    scelta: parseScelta(formData.get("scelta")),
    conferma: formData.get("conferma") === "on",
    attesi: attesiRaw === null || attesiRaw === "" ? null : Number(attesiRaw),
  };
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
      ? await salvaDb(
          sessione.supabase,
          partitaId,
          versione,
          a,
          b,
          sovrascrivi,
          opzioni,
        )
      : salvaDemo(tappaId, partitaId, versione, a, b, at, opzioni);
  } catch (error) {
    console.error("[punteggi] salvataggio non riuscito", error);
    esito = errore("network");
  }

  if (!esito.ok) {
    if ("motivo" in esito) {
      if (!esito.impatto) {
        return {
          status: "error",
          reason: "network",
          message: PUNTEGGIO_MESSAGES.network,
          at,
        };
      }
      return {
        status: "impatto",
        impatto: esito.impatto,
        mio: { a, b },
        versione,
        erroreConferma:
          esito.motivo === "conferma"
            ? erroreConferma(esito.impatto.punteggiPersi)
            : null,
        avviso:
          esito.motivo === "cambiato"
            ? messaggioImpattoCambiato(esito.impatto.punteggiPersi)
            : null,
        message: PUNTEGGIO_MESSAGES.impatto,
        at,
      };
    }
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

  await pubblica(
    sessione.supabase,
    tappaId,
    partitaId,
    esito.tipo === "correzione" ? "Punteggio corretto" : "Punteggio salvato",
  );
  refresh();
  return {
    status: "success",
    partitaId,
    versione: esito.versione,
    punteggio: { a, b },
    tipo: esito.tipo,
    scelta: esito.scelta,
    punteggiPersi: esito.punteggiPersi,
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

// ---------------------------------------------------------------------------
// BLVS-37 · Punteggio parziale
// ---------------------------------------------------------------------------

type EsitoParziale =
  | { ok: true; versione: number }
  | { ok: false; conflict: true }
  | { ok: false; reason: MotivoErroreParziale | "fieldErrors" };

async function parzialeDb(
  supabase: SupabaseClient,
  partitaId: string,
  versione: number,
  a: number,
  b: number,
  sovrascrivi: boolean,
): Promise<EsitoParziale> {
  if (!isUuid(partitaId)) return { ok: false, reason: "nonInCorso" };
  const { data, error } = await supabase.rpc("salva_parziale", {
    p_partita: partitaId,
    p_versione: versione,
    p_a: a,
    p_b: b,
    p_sovrascrivi: sovrascrivi,
  });
  if (error) {
    if (error.code === "42501") {
      return { ok: false, reason: "permissionDenied" };
    }
    switch (error.hint) {
      case "parziale_superato":
        return { ok: false, conflict: true };
      case "valori_non_validi":
        return { ok: false, reason: "fieldErrors" };
      case "partita_non_in_corso":
      case "tappa_archiviata":
        return { ok: false, reason: "nonInCorso" };
    }
    if (error.code === "P0002") return { ok: false, reason: "nonInCorso" };
    throw error;
  }
  const row = (data as { versione: number }[])[0];
  return { ok: true, versione: row.versione };
}

type ParzialeAttualeRow = {
  versione: number;
  a: number;
  b: number;
  autore: string | null;
  aggiornato_il: string;
};

/** The partial sent meanwhile by another admin, for the conflict dialog. */
async function leggiParzialeAttuale(
  supabase: SupabaseClient | null,
  tappaId: string,
  partitaId: string,
) {
  try {
    if (!supabase) {
      const demo = parzialeAttualeDemo(tappaId, partitaId);
      if (demo === undefined) return null;
      return parzialeComeUfficiale(
        demo && {
          versione: demo.versione,
          a: demo.a,
          b: demo.b,
          autore: null,
          aggiornatoIl: demo.aggiornatoIl,
        },
      );
    }
    const { data, error } = await supabase.rpc("parziale_attuale", {
      p_partita: partitaId,
    });
    if (error) throw error;
    const row = (data as ParzialeAttualeRow[])[0];
    return parzialeComeUfficiale(
      row
        ? {
            versione: row.versione,
            a: row.a,
            b: row.b,
            autore: row.autore,
            aggiornatoIl: row.aggiornato_il,
          }
        : null,
    );
  } catch (error) {
    console.error("[punteggi] lettura del parziale non riuscita", error);
    return null;
  }
}

/**
 * Only the match goes live: a partial changes no standing and no count of
 * results to enter, so neither is published.
 */
async function pubblicaParziale(
  supabase: SupabaseClient | null,
  tappaId: string,
  partitaId: string,
) {
  try {
    const elenco = supabase
      ? await leggiPunteggi(supabase, tappaId, partitaId)
      : getDemoPunteggi(tappaId);
    const partita = elenco?.partite.find((p) => p.id === partitaId);
    if (partita) publishScore(toLiveMatch(partita, tappaId));
  } catch (error) {
    console.error("[punteggi] pubblicazione del parziale non riuscita", error);
  }
}

/**
 * Sends the partial of a match in progress (BLVS-37, R-38): the players
 * see it on w-live within 5 s. It never touches the official score nor the
 * standings. `versione` is the partial's version the admin's values are
 * based on: a newer one from another admin ends in the conflict dialog;
 * `sovrascrivi=1` re-sends over the version shown there.
 */
export async function salvaParziale(
  _prev: ParzialeState,
  formData: FormData,
): Promise<ParzialeState> {
  const at = now().getTime();
  const sessione = await sessioneAdmin();
  if (!sessione.ok) {
    return {
      status: "error",
      reason: sessione.reason,
      message: PARZIALE_MESSAGES[sessione.reason],
      at,
    };
  }

  const tappaId = String(formData.get("tappaId") ?? "");
  const partitaId = String(formData.get("partitaId") ?? "");
  const versione = Number(formData.get("versione"));
  const sovrascrivi = formData.get("sovrascrivi") === "1";
  if (!tappaId || !partitaId || !Number.isInteger(versione) || versione < 0) {
    return {
      status: "error",
      reason: "nonInCorso",
      message: PARZIALE_MESSAGES.nonInCorso,
      at,
    };
  }
  const verifica = validaParziale({
    a: String(formData.get("puntiA") ?? ""),
    b: String(formData.get("puntiB") ?? ""),
  });
  if (!verifica.valido) {
    return {
      status: "fieldErrors",
      campi: verifica.campi,
      message: PARZIALE_MESSAGES.fieldErrors,
      at,
    };
  }
  const a = verifica.punti.a as number;
  const b = verifica.punti.b as number;

  let esito: EsitoParziale;
  try {
    if (sessione.supabase) {
      esito = await parzialeDb(
        sessione.supabase,
        partitaId,
        versione,
        a,
        b,
        sovrascrivi,
      );
    } else {
      const demo = salvaParzialeDemo(
        tappaId,
        partitaId,
        versione,
        { a, b },
        at,
      );
      esito =
        demo.status === "ok"
          ? { ok: true, versione: demo.versione }
          : demo.status === "versioneSuperata"
            ? { ok: false, conflict: true }
            : demo.status === "nonValido"
              ? { ok: false, reason: "fieldErrors" }
              : { ok: false, reason: "nonInCorso" };
    }
  } catch (error) {
    console.error("[punteggi] invio del parziale non riuscito", error);
    esito = { ok: false, reason: "network" };
  }

  if (!esito.ok) {
    if ("conflict" in esito) {
      const salvato = await leggiParzialeAttuale(
        sessione.supabase,
        tappaId,
        partitaId,
      );
      if (salvato) {
        return {
          status: "conflict",
          salvato,
          mio: { a, b },
          message: PARZIALE_MESSAGES.conflitto,
          at,
        };
      }
      return {
        status: "error",
        reason: "network",
        message: PARZIALE_MESSAGES.network,
        at,
      };
    }
    if (esito.reason === "fieldErrors") {
      return {
        status: "fieldErrors",
        campi: {},
        message: PARZIALE_MESSAGES.fieldErrors,
        at,
      };
    }
    return {
      status: "error",
      reason: esito.reason,
      message: PARZIALE_MESSAGES[esito.reason],
      at,
    };
  }

  await pubblicaParziale(sessione.supabase, tappaId, partitaId);
  refresh();
  return {
    status: "success",
    versione: esito.versione,
    punti: { a, b },
    message: PARZIALE_MESSAGES.inviato,
    at,
  };
}
