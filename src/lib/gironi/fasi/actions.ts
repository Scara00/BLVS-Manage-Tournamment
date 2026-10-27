"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import type { Categoria } from "@/lib/db/types";
import { generaFinaliDemo, proponiGoldSilverDemo } from "@/lib/demo/avvio-fase";
import { publishPhaseStarted } from "@/lib/live/publish";
import { readSupabaseEnv } from "@/lib/supabase/env";
import {
  CATEGORIA_NOME,
  parseCategoriaSegmento,
} from "@/lib/tappe/avvio/paths";
import { pubblicaTabellone } from "@/lib/tappe/live-admin/pubblica";
import { now } from "@/lib/time/server-time";
import { annuncioFase } from "./fase";
import {
  proponiFinali,
  proponiGoldSilver,
  proposta,
  type EsitoProposta,
} from "./qualificazione";
import { datiDemoProssimaFase, leggiDatiProssimaFase } from "./read";
import {
  PROSSIMA_FASE_MESSAGES as M,
  type ProssimaFaseState,
  type TipoProssimaFase,
} from "./types";
import type { DatiProssimaFase } from "./vista";

type PgError = { code?: string; hint?: string | null; message?: string };

type Motivo = Extract<ProssimaFaseState, { status: "error" }>["reason"];

class ErroreFase extends Error {
  constructor(
    readonly reason: Motivo,
    message: string,
  ) {
    super(message);
  }
}

async function sessioneAdmin(): Promise<SupabaseClient | null> {
  if (!readSupabaseEnv()) return null;
  let user: CurrentUser | null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error("[fasi] verifica della sessione non riuscita", error);
    user = null;
  }
  if (!user) throw new ErroreFase("sessionExpired", M.sessionExpired);
  if (user.ruolo !== "admin") {
    throw new ErroreFase("permissionDenied", M.permissionDenied);
  }
  return user.supabase;
}

/** The proposal, recomputed on the server: the client never sends it. */
function calcola(tipo: TipoProssimaFase, dati: DatiProssimaFase) {
  const atteso =
    tipo === "gold_silver" ? "gironi_iniziali" : "gironi_gold_silver";
  if (dati.faseGioco !== atteso || (tipo === "gold_silver" && dati.proposta)) {
    throw new ErroreFase("conflict", M.conflict);
  }
  const esito: EsitoProposta =
    tipo === "gold_silver"
      ? proponiGoldSilver(dati.gironi)
      : proponiFinali(dati.gironi);
  switch (esito.esito) {
    case "in_corso":
      throw new ErroreFase("blocked", M.inCorso);
    case "parita":
      throw new ErroreFase("blocked", M.parita);
    case "non_componibile":
      throw new ErroreFase("blocked", esito.messaggio);
    case "ok":
      return esito.gironi;
  }
}

function erroreDb(error: PgError): ErroreFase {
  if (error.code === "42501") {
    return new ErroreFase("permissionDenied", M.permissionDenied);
  }
  switch (error.hint) {
    case "gironi_non_conclusi":
      return new ErroreFase("blocked", M.inCorso);
    case "fase_non_proponibile":
    case "finali_gia_generate":
    case "tappa_non_avviabile":
    case "tappa_archiviata":
    case "proposta_non_valida":
    case "finale_non_valida":
      return new ErroreFase("conflict", M.conflict);
  }
  console.error("[fasi] salvataggio non riuscito", error);
  return new ErroreFase("network", M.network);
}

/** Returns the matches created (finals), or 0 for a proposal. */
async function salva(
  supabase: SupabaseClient | null,
  tipo: TipoProssimaFase,
  tappaId: string,
  categoria: Categoria,
): Promise<{ partite: number; tappaNome: string }> {
  if (!supabase) {
    const dati = datiDemoProssimaFase(tappaId, categoria);
    if (!dati) throw new ErroreFase("conflict", M.conflict);
    const gironi = calcola(tipo, dati).map((g) => ({
      fase: g.fase,
      nome: g.nome,
      iscrizioni: g.giocatori.map((p) => p.iscrizioneId),
    }));
    if (tipo === "gold_silver") {
      if (!proponiGoldSilverDemo(tappaId, categoria, gironi)) {
        throw new ErroreFase("conflict", M.conflict);
      }
      return { partite: 0, tappaNome: dati.tappa.nome };
    }
    const partite = generaFinaliDemo(tappaId, categoria, gironi);
    if (partite === null) throw new ErroreFase("conflict", M.conflict);
    return { partite, tappaNome: dati.tappa.nome };
  }

  const dati = await leggiDatiProssimaFase(supabase, tappaId, categoria, tipo);
  if (!dati) throw new ErroreFase("conflict", M.conflict);
  const gironi = proposta(calcola(tipo, dati));
  if (tipo === "gold_silver") {
    const { error } = await supabase.rpc("proponi_gironi_gold_silver", {
      p_tabellone: dati.tabelloneId,
      p_gironi: gironi,
    });
    if (error) throw erroreDb(error);
    return { partite: 0, tappaNome: dati.tappa.nome };
  }
  const { data, error } = await supabase.rpc("genera_finali", {
    p_tabellone: dati.tabelloneId,
    p_finali: gironi,
  });
  if (error) throw erroreDb(error);
  return { partite: (data as unknown[]).length, tappaNome: dati.tappa.nome };
}

/**
 * The next step of one board (BLVS-39): proposes the gold/silver groups
 * from the initial standings (then editable in the groups editor), or
 * generates the gold and silver finals and tells the live pages. A tie
 * still open blocks both (R-40).
 */
export async function proponiProssimaFase(
  _prev: ProssimaFaseState,
  formData: FormData,
): Promise<ProssimaFaseState> {
  const at = now().getTime();
  const tappaId = String(formData.get("tappaId") ?? "");
  const categoria = parseCategoriaSegmento(
    String(formData.get("categoria") ?? ""),
  );
  const tipo = formData.get("tipo");
  if (!tappaId || !categoria || (tipo !== "gold_silver" && tipo !== "finali")) {
    return { status: "error", reason: "conflict", message: M.conflict, at };
  }

  let esito: { partite: number; tappaNome: string };
  try {
    const supabase = await sessioneAdmin();
    esito = await salva(supabase, tipo, tappaId, categoria);
    if (tipo === "finali") {
      publishPhaseStarted({
        id: `${tappaId}:${categoria}`,
        stageId: tappaId,
        label: `${esito.tappaNome}, ${CATEGORIA_NOME[categoria]}`,
        category: categoria,
        phase: "finali",
        matches: esito.partite,
      });
      await pubblicaTabellone(
        { supabase },
        tappaId,
        categoria,
        annuncioFase("finali", esito.partite),
      );
    }
  } catch (error) {
    if (error instanceof ErroreFase) {
      if (error.reason === "blocked") refresh();
      return {
        status: "error",
        reason: error.reason,
        message: error.message,
        at,
      };
    }
    console.error("[fasi] prossima fase non riuscita", error);
    return { status: "error", reason: "network", message: M.network, at };
  }

  refresh();
  return {
    status: "success",
    message: tipo === "gold_silver" ? M.propostaSalvata : M.finaliGenerate,
    at,
  };
}
