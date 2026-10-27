/**
 * Stage standing per category (R-42, R-43). Pure and computed on read,
 * like the group standing (BLVS-27): a corrected score or a withdrawal is
 * reflected on the next read, there are no stored points to keep in step.
 *
 * The standing is made of the category's final groups (BLVS-39: a King/
 * Queen group of 4 per phase): the gold final first, then the silver one.
 * Players knocked out earlier are not listed (client decision).
 */
import type { FaseTabellone } from "@/lib/db/types";
import {
  classificaGirone,
  REGOLA_CLASSIFICA,
  statisticheGirone,
  vincitorePartita,
  type ClassificaGirone,
  type DecisioneSpareggio,
  type PartitaGirone,
} from "@/lib/gironi/classifica";
import { puntiPerPosizione } from "./punti";

export type GiocatoreFinale = {
  /** Registration id (`iscrizioni.id`). */
  iscrizioneId: string;
  nome: string;
  /** Withdrawn (`iscrizioni.stato = 'ritirata'`): ranked last of the final. */
  ritirato: boolean;
};

export type FinaleTappa = {
  gironeId: string;
  /** Gold/silver final; null while unknown, and then no points are given. */
  fase: FaseTabellone | null;
  giocatori: readonly GiocatoreFinale[];
  partite: readonly PartitaGirone[];
  /** Stored admin orders for perfect ties (`spareggi_girone`). */
  decisioni?: readonly DecisioneSpareggio[];
};

export type RigaClassificaTappa = {
  iscrizioneId: string;
  nome: string;
  fase: FaseTabellone | null;
  /** 1-based place in the category standing; tied players share it. */
  posizione: number;
  /** 1-based place inside its final, which sets the points. */
  posizioneFase: number;
  /** The place can no longer change, whatever the matches still to play. */
  posizioneDefinitiva: boolean;
  /** Null while the final's phase is unknown. */
  punti: number | null;
  /** True until the board is closed (BLVS-43, `tabelloni.concluso_il`). */
  puntiProvvisori: boolean;
  ritirato: boolean;
  /** In a perfect tie the admin has not resolved yet. */
  daRisolvere: boolean;
};

/**
 * - `in_attesa`: no final group yet.
 * - `in_corso`: some place can still change.
 * - `definitiva`: every place is settled, the board is still open.
 * - `conclusa`: the board is closed; points are final.
 */
export type StatoClassificaTappa =
  "in_attesa" | "in_corso" | "definitiva" | "conclusa";

export type ClassificaTappa = {
  righe: RigaClassificaTappa[];
  stato: StatoClassificaTappa;
  puntiProvvisori: boolean;
};

type Posto = {
  giocatore: GiocatoreFinale;
  posizione: number;
  definitiva: boolean;
  daRisolvere: boolean;
};

/** Beyond this many open matches the enumeration is skipped (never in a group of 4). */
const MAX_PARTITE_APERTE = 10;

/** Matches still to be decided: not voided and without a winner. */
function partiteAperte(partite: readonly PartitaGirone[]): PartitaGirone[] {
  return partite.filter(
    (p) => p.stato !== "annullata" && vincitorePartita(p) === null,
  );
}

/**
 * The places that can no longer change, by registration id. Wins are the
 * first criterion, so a player is settled when, over every outcome of the
 * open matches, each other player always ends with strictly more wins or
 * always with strictly fewer: then no tie-break can ever reach them.
 */
export function posizioniCerte(
  iscrizioni: readonly string[],
  partite: readonly PartitaGirone[],
): Map<string, number> {
  const certe = new Map<string, number>();
  if (REGOLA_CLASSIFICA.criteri[0] !== "vittorie") return certe;
  const aperte = partiteAperte(partite);
  if (aperte.length > MAX_PARTITE_APERTE) return certe;

  const base = new Map(
    statisticheGirone(iscrizioni, partite).map((s) => [
      s.iscrizioneId,
      s.vinte,
    ]),
  );
  // segni[x][y]: signs of (wins y − wins x) seen over all outcomes.
  const segni = new Map(
    iscrizioni.map((x) => [
      x,
      new Map(iscrizioni.map((y) => [y, new Set<number>()])),
    ]),
  );
  for (let esito = 0; esito < 1 << aperte.length; esito++) {
    const vinte = new Map(base);
    aperte.forEach((partita, i) => {
      const vincitori =
        esito & (1 << i) ? partita.squadre.A : partita.squadre.B;
      for (const id of vincitori) {
        if (vinte.has(id)) vinte.set(id, vinte.get(id)! + 1);
      }
    });
    for (const x of iscrizioni) {
      for (const y of iscrizioni) {
        if (x !== y)
          segni
            .get(x)!
            .get(y)!
            .add(Math.sign(vinte.get(y)! - vinte.get(x)!));
      }
    }
  }
  for (const x of iscrizioni) {
    let sopra = 0;
    let certa = true;
    for (const y of iscrizioni) {
      if (x === y) continue;
      const visti = segni.get(x)!.get(y)!;
      if (visti.size !== 1 || visti.has(0)) {
        certa = false;
        break;
      }
      if (visti.has(1)) sopra++;
    }
    if (certa) certe.set(x, sopra + 1);
  }
  return certe;
}

/**
 * Places `giocatori` from `primo` on: settled players take their certain
 * place, the others fill the free places in the order of the current
 * standing, and players level in it share a place.
 */
function assegnaPosti(
  giocatori: readonly GiocatoreFinale[],
  classifica: ClassificaGirone,
  certe: ReadonlyMap<string, number>,
  completa: boolean,
  primo: number,
): Posto[] {
  const perId = new Map(giocatori.map((g) => [g.iscrizioneId, g]));
  const posti: Posto[] = [];
  const occupati = new Set<number>();
  for (const [id, posizione] of certe) {
    occupati.add(posizione);
    posti.push({
      giocatore: perId.get(id)!,
      posizione: primo + posizione - 1,
      definitiva: true,
      daRisolvere: false,
    });
  }

  let libero = 1;
  const prossimoLibero = () => {
    while (occupati.has(libero)) libero++;
    return libero;
  };
  // Blocks of players sharing a place in the current standing.
  const blocchi = new Map<number, typeof classifica.righe>();
  for (const riga of classifica.righe) {
    if (certe.has(riga.iscrizioneId)) continue;
    blocchi.set(riga.posizione, [...(blocchi.get(riga.posizione) ?? []), riga]);
  }
  for (const righe of blocchi.values()) {
    const posizione = prossimoLibero();
    for (const riga of righe) {
      occupati.add(prossimoLibero());
      posti.push({
        giocatore: perId.get(riga.iscrizioneId)!,
        posizione: primo + posizione - 1,
        definitiva: completa && !riga.daRisolvere,
        daRisolvere: riga.daRisolvere,
      });
    }
  }
  return posti;
}

/** The places inside one final; withdrawn players come last. */
export function postiFinale(finale: FinaleTappa): Posto[] {
  const decisioni = finale.decisioni ?? [];
  const attivi = finale.giocatori.filter((g) => !g.ritirato);
  const ritirati = finale.giocatori.filter((g) => g.ritirato);
  const idAttivi = attivi.map((g) => g.iscrizioneId);
  const idRitirati = ritirati.map((g) => g.iscrizioneId);

  const classificaAttivi = classificaGirone(idAttivi, finale.partite, {
    decisioni,
  });
  const terminata = classificaAttivi.stato !== "in_corso";
  const certe = terminata
    ? new Map<string, number>()
    : posizioniCerte(idAttivi, finale.partite);

  const classificaRitirati = classificaGirone(idRitirati, finale.partite, {
    decisioni,
  });
  // A lone withdrawn player is last whatever happens.
  const ritiratiCerti =
    ritirati.length === 1
      ? new Map([[ritirati[0].iscrizioneId, 1]])
      : new Map<string, number>();

  return [
    ...assegnaPosti(attivi, classificaAttivi, certe, terminata, 1),
    ...assegnaPosti(
      ritirati,
      classificaRitirati,
      ritiratiCerti,
      terminata,
      attivi.length + 1,
    ),
  ];
}

const ORDINE_FASE: Record<FaseTabellone, number> = { gold: 0, silver: 1 };
const ordineFase = (fase: FaseTabellone | null) =>
  fase === null ? 2 : ORDINE_FASE[fase];

/**
 * The stage standing of one category. `concluso` = the board is closed
 * (`tabelloni.concluso_il` set): until then every point is provisional.
 */
export function classificaTappa({
  finali,
  concluso,
}: {
  finali: readonly FinaleTappa[];
  concluso: boolean;
}): ClassificaTappa {
  const puntiProvvisori = !concluso;
  const ordinate = [...finali].sort(
    (x, y) => ordineFase(x.fase) - ordineFase(y.fase),
  );

  const righe: RigaClassificaTappa[] = [];
  let precedenti = 0;
  for (const finale of ordinate) {
    const posti = postiFinale(finale).sort(
      (x, y) =>
        x.posizione - y.posizione ||
        x.giocatore.nome.localeCompare(y.giocatore.nome, "it"),
    );
    for (const posto of posti) {
      righe.push({
        iscrizioneId: posto.giocatore.iscrizioneId,
        nome: posto.giocatore.nome,
        fase: finale.fase,
        posizione: precedenti + posto.posizione,
        posizioneFase: posto.posizione,
        posizioneDefinitiva: posto.definitiva,
        punti:
          finale.fase === null
            ? null
            : puntiPerPosizione(finale.fase, posto.posizione),
        puntiProvvisori,
        ritirato: posto.giocatore.ritirato,
        daRisolvere: posto.daRisolvere,
      });
    }
    precedenti += finale.giocatori.length;
  }

  const stato: StatoClassificaTappa =
    ordinate.length === 0
      ? "in_attesa"
      : concluso
        ? "conclusa"
        : righe.every((r) => r.posizioneDefinitiva)
          ? "definitiva"
          : "in_corso";
  return { righe, stato, puntiProvvisori };
}
