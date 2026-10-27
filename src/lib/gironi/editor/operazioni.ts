import {
  NON_ASSEGNATI,
  type ComposizioneGironi,
  type Destinazione,
  type GiocatoreGirone,
  type GironeEditor,
  type OperazioneGironi,
} from "./types";

export type EsitoOperazione =
  | { ok: true; composizione: ComposizioneGironi }
  | { ok: false; errore: "giocatore_non_trovato" | "girone_non_trovato" };

/** Where a player is: a group id, `NON_ASSEGNATI`, or null if unknown. */
export function posizioneGiocatore(
  composizione: ComposizioneGironi,
  iscrizioneId: string,
): Destinazione | null {
  for (const girone of composizione.gironi) {
    if (girone.giocatori.some((g) => g.iscrizioneId === iscrizioneId)) {
      return girone.id;
    }
  }
  return composizione.nonAssegnati.some((g) => g.iscrizioneId === iscrizioneId)
    ? NON_ASSEGNATI
    : null;
}

export function trovaGiocatore(
  composizione: ComposizioneGironi,
  iscrizioneId: string,
): GiocatoreGirone | null {
  for (const lista of [
    ...composizione.gironi.map((g) => g.giocatori),
    composizione.nonAssegnati,
  ]) {
    const giocatore = lista.find((g) => g.iscrizioneId === iscrizioneId);
    if (giocatore) return giocatore;
  }
  return null;
}

export function nomeDestinazione(
  composizione: ComposizioneGironi,
  destinazione: Destinazione,
): string {
  if (destinazione === NON_ASSEGNATI) return "Non assegnati";
  return (
    composizione.gironi.find((g) => g.id === destinazione)?.nome ?? "girone"
  );
}

/**
 * The first free «Girone A…Z» name, then «Girone 27», «Girone 28»… Same
 * rule as `aggiungi_girone()` in the DB.
 */
export function prossimoNomeGirone(gironi: readonly { nome: string }[]) {
  const usati = new Set(gironi.map((g) => g.nome));
  for (let i = 0; i < 26; i += 1) {
    const nome = `Girone ${String.fromCharCode(65 + i)}`;
    if (!usati.has(nome)) return nome;
  }
  for (let n = 27; ; n += 1) {
    if (!usati.has(`Girone ${n}`)) return `Girone ${n}`;
  }
}

function senza(lista: GiocatoreGirone[], iscrizioneId: string) {
  return lista.filter((g) => g.iscrizioneId !== iscrizioneId);
}

/** Puts `giocatore` into `verso`, at the end (or at `indice`). */
function inserisci(
  composizione: ComposizioneGironi,
  giocatore: GiocatoreGirone,
  verso: Destinazione,
  indice?: number,
): ComposizioneGironi {
  const aggiungi = (lista: GiocatoreGirone[]) => {
    const copia = [...lista];
    copia.splice(indice ?? copia.length, 0, giocatore);
    return copia;
  };
  if (verso === NON_ASSEGNATI) {
    return {
      ...composizione,
      nonAssegnati: aggiungi(composizione.nonAssegnati),
    };
  }
  return {
    ...composizione,
    gironi: composizione.gironi.map((g) =>
      g.id === verso ? { ...g, giocatori: aggiungi(g.giocatori) } : g,
    ),
  };
}

function togli(
  composizione: ComposizioneGironi,
  iscrizioneId: string,
): ComposizioneGironi {
  return {
    ...composizione,
    gironi: composizione.gironi.map((g) => ({
      ...g,
      giocatori: senza(g.giocatori, iscrizioneId),
    })),
    nonAssegnati: senza(composizione.nonAssegnati, iscrizioneId),
  };
}

function esisteDestinazione(c: ComposizioneGironi, d: Destinazione) {
  return d === NON_ASSEGNATI || c.gironi.some((g) => g.id === d);
}

function indiceIn(
  c: ComposizioneGironi,
  d: Destinazione,
  iscrizioneId: string,
): number {
  const lista =
    d === NON_ASSEGNATI
      ? c.nonAssegnati
      : (c.gironi.find((g) => g.id === d)?.giocatori ?? []);
  return lista.findIndex((g) => g.iscrizioneId === iscrizioneId);
}

/**
 * Applies one change to a copy of the groups. Pure: the editor uses it for
 * the optimistic view, the demo store to save, the tests to check rules.
 * A new group gets the id `nuovoId` (the DB gives the real one).
 */
export function applicaOperazione(
  composizione: ComposizioneGironi,
  operazione: OperazioneGironi,
  nuovoId: () => string = () => `nuovo-${crypto.randomUUID()}`,
): EsitoOperazione {
  switch (operazione.tipo) {
    case "sposta": {
      const giocatore = trovaGiocatore(composizione, operazione.iscrizioneId);
      if (!giocatore) return { ok: false, errore: "giocatore_non_trovato" };
      if (!esisteDestinazione(composizione, operazione.verso)) {
        return { ok: false, errore: "girone_non_trovato" };
      }
      if (
        posizioneGiocatore(composizione, operazione.iscrizioneId) ===
        operazione.verso
      ) {
        return { ok: true, composizione };
      }
      return {
        ok: true,
        composizione: inserisci(
          togli(composizione, operazione.iscrizioneId),
          giocatore,
          operazione.verso,
        ),
      };
    }
    case "scambia": {
      const a = trovaGiocatore(composizione, operazione.a);
      const b = trovaGiocatore(composizione, operazione.b);
      if (!a || !b) return { ok: false, errore: "giocatore_non_trovato" };
      const da = posizioneGiocatore(composizione, a.iscrizioneId)!;
      const db = posizioneGiocatore(composizione, b.iscrizioneId)!;
      if (da === db) return { ok: true, composizione };
      // Each takes the other's place, at the same row.
      const ia = indiceIn(composizione, da, a.iscrizioneId);
      const ib = indiceIn(composizione, db, b.iscrizioneId);
      let dopo = togli(togli(composizione, a.iscrizioneId), b.iscrizioneId);
      dopo = inserisci(dopo, b, da, ia);
      dopo = inserisci(dopo, a, db, ib);
      return { ok: true, composizione: dopo };
    }
    case "aggiungi": {
      const posizione =
        Math.max(0, ...composizione.gironi.map((g) => g.posizione)) + 1;
      const girone: GironeEditor = {
        id: nuovoId(),
        nome: prossimoNomeGirone(composizione.gironi),
        posizione,
        fase: composizione.fase,
        giocatori: [],
      };
      return {
        ok: true,
        composizione: {
          ...composizione,
          gironi: [...composizione.gironi, girone],
        },
      };
    }
    case "elimina": {
      const girone = composizione.gironi.find(
        (g) => g.id === operazione.gironeId,
      );
      if (!girone) return { ok: false, errore: "girone_non_trovato" };
      return {
        ok: true,
        composizione: {
          ...composizione,
          gironi: composizione.gironi.filter((g) => g.id !== girone.id),
          nonAssegnati: [...composizione.nonAssegnati, ...girone.giocatori],
        },
      };
    }
  }
}

/** The groups touched by a change (their scheduled matches are dropped). */
export function gironiCoinvolti(
  composizione: ComposizioneGironi,
  operazione: OperazioneGironi,
): string[] {
  const posti = (() => {
    switch (operazione.tipo) {
      case "sposta":
        return [
          posizioneGiocatore(composizione, operazione.iscrizioneId),
          operazione.verso,
        ];
      case "scambia":
        return [
          posizioneGiocatore(composizione, operazione.a),
          posizioneGiocatore(composizione, operazione.b),
        ];
      case "elimina":
        return [operazione.gironeId];
      case "aggiungi":
        return [];
    }
  })();
  return [
    ...new Set(
      posti.filter((p): p is string => p !== null && p !== NON_ASSEGNATI),
    ),
  ];
}
