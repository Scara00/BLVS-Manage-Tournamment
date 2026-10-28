"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { pubblicaClassificaGenerale } from "@/lib/classifica-generale/pubblica";
import { risolviParitaDemo } from "@/lib/demo/parita";
import {
  classificaGirone,
  risolviParitaGirone,
  SPAREGGIO_MESSAGES,
} from "@/lib/gironi/classifica";
import { publishGroupStandings } from "@/lib/live/publish";
import { toGroupStandings } from "@/lib/punteggi/format";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { leggiDatiParitaTabellone } from "./dati";
import {
  annuncioOrdine,
  componiMotivo,
  erroriMotivo,
  leggiRichiestaParita,
  paritaGirone,
  type DatiParitaGirone,
} from "./format";
import {
  PARITA_MESSAGES as M,
  type MotivoParita,
  type MotivoRifiutoParita,
  type RisolviParitaState,
} from "./types";

function prossimo(prev: RisolviParitaState): number {
  return prev.status === "idle" ? 1 : prev.at + 1;
}

function errore(
  reason: MotivoRifiutoParita,
  at: number,
  message: string = M[reason],
): RisolviParitaState {
  return { status: "error", reason, message, at };
}

type Sessione =
  | { ok: true; supabase: SupabaseClient }
  | { ok: false; reason: "sessionExpired" | "permissionDenied" };

async function sessioneAdmin(): Promise<Sessione> {
  let user: CurrentUser | null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error("[gironi] verifica della sessione non riuscita", error);
    user = null;
  }
  if (!user) return { ok: false, reason: "sessionExpired" };
  if (user.ruolo !== "admin") return { ok: false, reason: "permissionDenied" };
  return { ok: true, supabase: user.supabase };
}

/** The announcement of the saved order, read back from the group. */
function successo(
  dati: DatiParitaGirone | undefined,
  firma: string,
  at: number,
): RisolviParitaState {
  const parita = dati ? paritaGirone(dati).parita : [];
  const decisa = parita.find((p) => p.firma === firma);
  const message =
    dati && decisa
      ? annuncioOrdine(
          dati.gironeNome,
          decisa.posizione,
          decisa.giocatori.map((g) => g.nome),
        )
      : "Ordine deciso.";
  return { status: "success", message, firma, at };
}

/**
 * The live pages get the group's new standing at once, and w-classifica
 * the overall one: a decided tie in a final moves stage points (BLVS-44).
 */
async function pubblica(dati: DatiParitaGirone | undefined) {
  if (!dati) return;
  await pubblicaClassificaGenerale(dati.tappaId);
  try {
    const classifica = classificaGirone(
      dati.giocatori.map((g) => g.iscrizioneId),
      dati.partite,
      { decisioni: dati.decisioni },
    );
    publishGroupStandings(
      toGroupStandings(
        { id: dati.gironeId, nome: dati.gironeNome },
        classifica,
        new Map(dati.giocatori.map((g) => [g.iscrizioneId, g.nome])),
        { stageId: dati.tappaId, category: dati.categoria },
      ),
    );
  } catch (error) {
    console.error("[gironi] pubblicazione live non riuscita", error);
  }
}

/**
 * w-admin-parita: saves the admin's order for a perfect tie (R-40), or
 * replaces an earlier decision. The reason is a preset plus free text. The
 * database checks the tie, stores the order and writes `parita_risolta`
 * to the registro with the author (RPC `risolvi_parita_girone`).
 */
export async function risolviParita(
  prev: RisolviParitaState,
  formData: FormData,
): Promise<RisolviParitaState> {
  const at = prossimo(prev);
  const richiesta = leggiRichiestaParita(formData);
  if (!richiesta) return errore("invalid", at);
  const { tappaId, categoria, gironeId, firma, ordine } = richiesta;

  const campi = erroriMotivo(richiesta.motivo, richiesta.note);
  if (campi) return { status: "fieldErrors", fields: campi, at };
  const motivo = componiMotivo(
    richiesta.motivo as MotivoParita,
    richiesta.note,
  );

  if (!readSupabaseEnv()) {
    const esito = risolviParitaDemo({
      tappaId,
      categoria,
      gironeId,
      firma,
      ordine,
      motivo,
    });
    if (!esito.ok) {
      switch (esito.motivo) {
        case "nonTrovato":
          return errore("notFound", at);
        case "conflict":
          return errore("conflict", at);
        case "ordineNonValido":
          return {
            status: "fieldErrors",
            fields: { ordine: M.ordineNonValido },
            at,
          };
      }
    }
    refresh();
    await pubblica(esito.dati);
    return successo(esito.dati, firma, at);
  }

  if (!isUuid(tappaId) || !isUuid(gironeId)) return errore("notFound", at);
  if (!ordine.every(isUuid)) return errore("invalid", at);
  const sessione = await sessioneAdmin();
  if (!sessione.ok) return errore(sessione.reason, at);
  const { supabase } = sessione;

  try {
    const esito = await risolviParitaGirone(supabase, {
      gironeId,
      firma,
      ordine,
      motivo,
    });
    if (!esito.ok) {
      if (esito.reason === "invalid") {
        return {
          status: "fieldErrors",
          fields:
            esito.message === SPAREGGIO_MESSAGES.ordineNonValido
              ? { ordine: M.ordineNonValido }
              : { note: esito.message },
          at,
        };
      }
      return errore(
        esito.reason,
        at,
        esito.reason === "conflict" ? esito.message : M[esito.reason],
      );
    }
    refresh();
    const dati = (
      await leggiDatiParitaTabellone(supabase, tappaId, categoria)
    )?.find((g) => g.gironeId === gironeId);
    await pubblica(dati);
    return successo(dati, firma, at);
  } catch (error) {
    console.error("[gironi] decisione della parità non salvata", error);
    return errore("network", at);
  }
}
