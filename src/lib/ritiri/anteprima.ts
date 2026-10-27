/**
 * The preview of w-admin-ritiro: what the rule does to each chosen match
 * and to the group standing, computed with the same rule and the same
 * standing as the server (BLVS-27), before anything is saved.
 */
import type { SetPunteggio, StatoPartita } from "@/lib/db/types";
import {
  classificaGirone,
  type ClassificaGirone,
  type PartitaGirone,
} from "@/lib/gironi/classifica";
import { descriviPartita } from "@/lib/tappe/live-admin/format";
import type { PartitaLive } from "@/lib/tappe/live-admin/types";
import { applicaRegola, REGOLA_RITIRO, type RegolaRitiro } from "./regola";
import type { AssenzaRegistrata, TipoRitiro } from "./types";

export type GiocatoreGirone = { iscrizioneId: string; nome: string };

/** «Rossi Luca» (surname first, as in the standings). */
export function nomeGiocatore(g: { nome: string; cognome: string }) {
  return `${g.cognome} ${g.nome}`.trim();
}

/** The players of a group's matches, by surname. */
export function giocatoriGirone(
  partite: readonly PartitaLive[],
): GiocatoreGirone[] {
  const perId = new Map<string, GiocatoreGirone>();
  for (const p of partite) {
    for (const g of [...p.squadraA, ...p.squadraB]) {
      perId.set(g.iscrizioneId, {
        iscrizioneId: g.iscrizioneId,
        nome: nomeGiocatore(g),
      });
    }
  }
  return [...perId.values()].sort((a, b) => a.nome.localeCompare(b.nome, "it"));
}

function gioca(p: PartitaLive, iscrizioneId: string) {
  return [...p.squadraA, ...p.squadraB].some(
    (g) => g.iscrizioneId === iscrizioneId,
  );
}

export type PartitaScelta = {
  partita: PartitaLive;
  /** False for a voided match or one already recorded: shown, not choosable. */
  disponibile: boolean;
  motivo: string | null;
};

/** The player's matches of the group, in round order. */
export function partiteDelGiocatore(
  partite: readonly PartitaLive[],
  iscrizioneId: string,
  assenze: readonly AssenzaRegistrata[] = [],
): PartitaScelta[] {
  return partite
    .filter((p) => gioca(p, iscrizioneId))
    .sort((a, b) => a.turno - b.turno)
    .map((partita) => {
      const registrata = assenze.some(
        (a) => a.partitaId === partita.id && a.iscrizioneId === iscrizioneId,
      );
      if (registrata) {
        return { partita, disponibile: false, motivo: "già registrata" };
      }
      if (partita.stato === "annullata") {
        return { partita, disponibile: false, motivo: "annullata" };
      }
      return { partita, disponibile: true, motivo: null };
    });
}

/**
 * The matches ticked when the type is chosen: a withdrawal covers every
 * match not concluded yet; an absence starts with none.
 */
export function preselezione(
  tipo: TipoRitiro,
  scelte: readonly PartitaScelta[],
): string[] {
  if (tipo === "assenza") return [];
  return scelte
    .filter((s) => s.disponibile && s.partita.stato !== "conclusa")
    .map((s) => s.partita.id);
}

/** «21–18», «da giocare» or «annullata». */
export function descriviRisultato(
  stato: StatoPartita,
  sets: readonly SetPunteggio[],
) {
  if (stato === "annullata") return "annullata";
  if (sets.length === 0)
    return stato === "in_corso" ? "in corso" : "da giocare";
  return sets.map((s) => `${s.a}–${s.b}`).join(", ");
}

export type RigaAnteprima = {
  partitaId: string;
  partita: string;
  prima: string;
  dopo: string;
  /** A saved score that the rule overwrites (a correction in the registro). */
  sovrascrive: boolean;
};

function daPartitaLive(p: PartitaLive): PartitaGirone {
  return {
    id: p.id,
    stato: p.stato,
    squadre: {
      A: p.squadraA.map((g) => g.iscrizioneId),
      B: p.squadraB.map((g) => g.iscrizioneId),
    },
    sets: p.sets,
  };
}

/** Per chosen match: its result now and after the rule. */
export function anteprimaRitiro(
  partite: readonly PartitaLive[],
  iscrizioneId: string,
  scelte: readonly string[],
  regola: RegolaRitiro = REGOLA_RITIRO,
): RigaAnteprima[] {
  return partite
    .filter((p) => scelte.includes(p.id))
    .sort((a, b) => a.turno - b.turno)
    .map((p) => {
      const dopo = applicaRegola(daPartitaLive(p), iscrizioneId, regola);
      return {
        partitaId: p.id,
        partita: descriviPartita(p),
        prima: descriviRisultato(p.stato, p.sets),
        dopo: descriviRisultato(dopo.stato, dopo.sets),
        sovrascrive: p.sets.length > 0,
      };
    });
}

/** The group's matches after the rule, for the standing. */
export function partiteDopoRitiro(
  partite: readonly PartitaLive[],
  iscrizioneId: string,
  scelte: readonly string[],
  regola: RegolaRitiro = REGOLA_RITIRO,
): PartitaGirone[] {
  return partite.map((p) => {
    const g = daPartitaLive(p);
    return scelte.includes(p.id)
      ? { ...g, ...applicaRegola(g, iscrizioneId, regola) }
      : g;
  });
}

/** The group standing before and after the rule (BLVS-27's, on read). */
export function classificaRitiro(
  partite: readonly PartitaLive[],
  iscrizioneId: string,
  scelte: readonly string[],
  regola: RegolaRitiro = REGOLA_RITIRO,
): { prima: ClassificaGirone; dopo: ClassificaGirone } {
  const iscrizioni = giocatoriGirone(partite).map((g) => g.iscrizioneId);
  return {
    prima: classificaGirone(iscrizioni, partite.map(daPartitaLive)),
    dopo: classificaGirone(
      iscrizioni,
      partiteDopoRitiro(partite, iscrizioneId, scelte, regola),
    ),
  };
}

export type CambioClassifica = {
  iscrizioneId: string;
  nome: string;
  prima: number;
  dopo: number;
  vinteDopo: number;
  giocateDopo: number;
};

/** «Cosa cambia» in the standing: every player's place before and after. */
export function cosaCambiaRitiro(
  partite: readonly PartitaLive[],
  iscrizioneId: string,
  scelte: readonly string[],
  regola: RegolaRitiro = REGOLA_RITIRO,
): CambioClassifica[] {
  const nomi = new Map(
    giocatoriGirone(partite).map((g) => [g.iscrizioneId, g.nome]),
  );
  const { prima, dopo } = classificaRitiro(
    partite,
    iscrizioneId,
    scelte,
    regola,
  );
  const posizionePrima = new Map(
    prima.righe.map((r) => [r.iscrizioneId, r.posizione]),
  );
  return dopo.righe.map((r) => ({
    iscrizioneId: r.iscrizioneId,
    nome: nomi.get(r.iscrizioneId) ?? r.iscrizioneId,
    prima: posizionePrima.get(r.iscrizioneId) ?? r.posizione,
    dopo: r.posizione,
    vinteDopo: r.vinte,
    giocateDopo: r.giocate,
  }));
}

/** «2ª → 3ª», or «resta 1ª». */
export function descriviCambio(c: CambioClassifica) {
  return c.prima === c.dopo
    ? `resta ${c.dopo}ª`
    : `da ${c.prima}ª a ${c.dopo}ª`;
}
