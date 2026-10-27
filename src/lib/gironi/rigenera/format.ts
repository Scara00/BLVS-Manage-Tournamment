import type { PunteggioPerso, SetPunteggio } from "./types";

/** «1 punteggio», «3 punteggi». */
export function contaPunteggi(n: number): string {
  return n === 1 ? "1 punteggio" : `${n} punteggi`;
}

/** «21-18, 19-21». */
export function descriviSets(sets: readonly SetPunteggio[]): string {
  return sets.map((s) => `${s.a}-${s.b}`).join(", ");
}

/** «Giulia Bianchi e Marco Rossi». */
export function descriviSquadra(giocatori: readonly string[]): string {
  if (giocatori.length === 0) return "squadra senza giocatori";
  if (giocatori.length === 1) return giocatori[0];
  return `${giocatori.slice(0, -1).join(", ")} e ${giocatori.at(-1)}`;
}

/** «Girone A · turno 1», the heading of one lost score. */
export function partitaPersa(p: PunteggioPerso): string {
  return `${p.girone ?? "Girone"} · turno ${p.turno}`;
}

/**
 * One lost score in words, for screen readers and the log:
 * «Girone A · turno 1: Giulia Bianchi e Marco Rossi contro … , 21-18, 19-21».
 */
export function descriviPunteggioPerso(p: PunteggioPerso): string {
  return `${partitaPersa(p)}: ${descriviSquadra(p.squadraA)} contro ${descriviSquadra(p.squadraB)}, ${descriviSets(p.sets)}`;
}

/** The dialog's warning: «Rigenerando perdi 3 punteggi già inseriti.» */
export function avvisoPerdita(n: number): string {
  if (n === 0) return "Non si perde nessun punteggio.";
  return n === 1
    ? "Rigenerando perdi 1 punteggio già inserito."
    : `Rigenerando perdi ${n} punteggi già inseriti.`;
}

/** Error next to the unticked box. */
export function erroreConferma(n: number): string {
  return `Spunta la casella per confermare che perdi ${contaPunteggi(n)}.`;
}

/** Label of the confirmation box. */
export function etichettaConferma(n: number): string {
  return n === 1
    ? "Ho capito che il punteggio inserito si perde"
    : `Ho capito che i ${n} punteggi inseriti si perdono`;
}

/** The scores changed while the dialog was open. */
export function messaggioPunteggiCambiati(n: number): string {
  return n === 0
    ? "Nel frattempo i punteggi sono cambiati: ora non se ne perde nessuno. Puoi rigenerare."
    : `Nel frattempo i punteggi sono cambiati: ora se ne perdono ${n}. Controlla l'elenco e conferma di nuovo.`;
}

export function messaggioSuccesso(persi: number, gironi: number): string {
  const nuovi = gironi === 1 ? "1 girone" : `${gironi} gironi`;
  return persi === 0
    ? `Gironi rigenerati: ${nuovi}.`
    : `Gironi rigenerati: ${nuovi}. ${persi === 1 ? "Perso 1 punteggio" : `Persi ${persi} punteggi`}, annotati nel registro.`;
}

/** A row of RPC `punteggi_rigenerazione`. */
export type PunteggioPersoRow = {
  partita_id: string;
  girone: string | null;
  turno: number;
  stato: PunteggioPerso["stato"];
  sets: unknown;
  squadra_a: string[] | null;
  squadra_b: string[] | null;
};

function sets(value: unknown): SetPunteggio[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((s) =>
    s &&
    typeof s === "object" &&
    Number.isFinite((s as SetPunteggio).a) &&
    Number.isFinite((s as SetPunteggio).b)
      ? [{ a: (s as SetPunteggio).a, b: (s as SetPunteggio).b }]
      : [],
  );
}

export function toPunteggiPersi(
  rows: readonly PunteggioPersoRow[],
): PunteggioPerso[] {
  return rows.map((r) => ({
    partitaId: r.partita_id,
    girone: r.girone,
    turno: r.turno,
    stato: r.stato,
    sets: sets(r.sets),
    squadraA: r.squadra_a ?? [],
    squadraB: r.squadra_b ?? [],
  }));
}
