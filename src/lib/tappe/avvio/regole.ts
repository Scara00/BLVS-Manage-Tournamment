import type { Categoria, FaseGioco, StatoTappa } from "@/lib/db/types";

/**
 * Rules for starting the group phase of one board. Mirror of
 * `public.regola_avvio()` and `public.controlli_avvio_fase()` (migration
 * 20261027360000_avvio_fase.sql), which are the real guard: change both.
 * TODO(Q-05): the exceptions are still to be confirmed by the client.
 */
export type RegolaAvvio = {
  /** Confirmed players every group must have. */
  dimensione: number;
  /**
   * Lets the phase start with fewer than `dimensione` confirmed players
   * outside the groups (those left over by the BLVS-26 draw).
   */
  ammettiResto: boolean;
};

export const REGOLA_AVVIO: RegolaAvvio = {
  dimensione: 4,
  ammettiResto: false,
};

/** The rule keys returned by `controlli_avvio_fase`. */
export const REGOLE_BLOCCO = [
  "nessun_girone",
  "girone_non_da_4",
  "doppione",
  "non_assegnato",
] as const;
export type RegolaBlocco = (typeof REGOLE_BLOCCO)[number];

export function isRegolaBlocco(value: unknown): value is RegolaBlocco {
  return (REGOLE_BLOCCO as readonly unknown[]).includes(value);
}

/** One reason the phase cannot start; same shape as the SQL rows. */
export type ProblemaAvvio = {
  regola: RegolaBlocco;
  gironeId: string | null;
  gironeNome: string | null;
  /** Player count (girone_non_da_4) or «Cognome Nome» (the others). */
  dettaglio: string | null;
};

/** A confirmed player in a group; `lettera` is A, B, C, D… */
export type GiocatoreAvvio = {
  iscrizioneId: string;
  utenteId: string;
  lettera: string;
  nome: string;
  cognome: string;
};

export type GironeAvvio = {
  id: string;
  nome: string;
  giocatori: GiocatoreAvvio[];
};

export type IscrittoFuori = {
  iscrizioneId: string;
  nome: string;
  cognome: string;
};

/** What the start screen reads for one board. */
export type TabelloneAvvio = {
  tappa: { id: string; nome: string; stato: StatoTappa };
  categoria: Categoria;
  tabelloneId: string;
  faseGioco: FaseGioco | null;
  gironi: GironeAvvio[];
  /** Confirmed players of the board who are in no group. */
  nonAssegnati: IscrittoFuori[];
};

function nomeCompleto(g: { nome: string; cognome: string }): string {
  return `${g.cognome} ${g.nome}`.trim();
}

/** Same rules, order and output as `controlli_avvio_fase`. */
export function controllaAvvio(
  tabellone: Pick<TabelloneAvvio, "gironi" | "nonAssegnati">,
  regola: RegolaAvvio = REGOLA_AVVIO,
): ProblemaAvvio[] {
  const problemi: ProblemaAvvio[] = [];
  const { gironi, nonAssegnati } = tabellone;

  if (gironi.length === 0) {
    problemi.push({
      regola: "nessun_girone",
      gironeId: null,
      gironeNome: null,
      dettaglio: null,
    });
  }

  for (const g of gironi) {
    if (g.giocatori.length !== regola.dimensione) {
      problemi.push({
        regola: "girone_non_da_4",
        gironeId: g.id,
        gironeNome: g.nome,
        dettaglio: String(g.giocatori.length),
      });
    }
  }

  const volte = new Map<string, number>();
  for (const g of gironi) {
    for (const p of g.giocatori) {
      volte.set(p.utenteId, (volte.get(p.utenteId) ?? 0) + 1);
    }
  }
  for (const g of gironi) {
    const doppi = g.giocatori
      .filter((p) => (volte.get(p.utenteId) ?? 0) > 1)
      .sort((a, b) => nomeCompleto(a).localeCompare(nomeCompleto(b), "it"));
    for (const p of doppi) {
      problemi.push({
        regola: "doppione",
        gironeId: g.id,
        gironeNome: g.nome,
        dettaglio: nomeCompleto(p),
      });
    }
  }

  const tollerati =
    regola.ammettiResto && nonAssegnati.length < regola.dimensione;
  if (!tollerati) {
    const fuori = [...nonAssegnati].sort((a, b) =>
      nomeCompleto(a).localeCompare(nomeCompleto(b), "it"),
    );
    for (const p of fuori) {
      problemi.push({
        regola: "non_assegnato",
        gironeId: null,
        gironeNome: null,
        dettaglio: nomeCompleto(p),
      });
    }
  }

  return problemi;
}

/** The three checks shown on one row: groups of 4, no doubles, all assigned. */
export const CONTROLLI = [
  { chiave: "gironi", label: "Gironi da 4" },
  { chiave: "doppioni", label: "Nessun doppione" },
  { chiave: "assegnati", label: "Tutti gli iscritti assegnati" },
] as const;
export type ChiaveControllo = (typeof CONTROLLI)[number]["chiave"];

export function controlloDi(regola: RegolaBlocco): ChiaveControllo {
  switch (regola) {
    case "nessun_girone":
    case "girone_non_da_4":
      return "gironi";
    case "doppione":
      return "doppioni";
    case "non_assegnato":
      return "assegnati";
  }
}

export type ControlloView = {
  chiave: ChiaveControllo;
  label: string;
  ok: boolean;
  /** How many problems this check found. */
  problemi: number;
};

export function controlliView(
  problemi: readonly ProblemaAvvio[],
): ControlloView[] {
  return CONTROLLI.map(({ chiave, label }) => {
    const n = problemi.filter((p) => controlloDi(p.regola) === chiave).length;
    return { chiave, label, ok: n === 0, problemi: n };
  });
}

/** One error, in the admin's words. */
export function messaggioProblema(
  problema: ProblemaAvvio,
  regola: RegolaAvvio = REGOLA_AVVIO,
): string {
  switch (problema.regola) {
    case "nessun_girone":
      return "Il tabellone non ha ancora gironi: componili prima di avviare la fase.";
    case "girone_non_da_4": {
      const n = Number(problema.dettaglio ?? 0);
      const giocatori = n === 1 ? "1 giocatore" : `${n} giocatori`;
      return `${problema.gironeNome}: ha ${giocatori} invece di ${regola.dimensione}.`;
    }
    case "doppione":
      return `${problema.gironeNome}: ${problema.dettaglio} è anche in un altro girone.`;
    case "non_assegnato":
      return `${problema.dettaglio} non è in nessun girone.`;
  }
}

/**
 * The King/Queen rotation of a group of 4: everyone partners each of the
 * other three once. Same table as `avvia_fase`.
 */
export const ROTAZIONE = [
  { turno: 1, a: ["A", "B"], b: ["C", "D"] },
  { turno: 2, a: ["A", "C"], b: ["B", "D"] },
  { turno: 3, a: ["A", "D"], b: ["B", "C"] },
] as const;

export type PartitaAnteprima = {
  turno: number;
  squadraA: GiocatoreAvvio[];
  squadraB: GiocatoreAvvio[];
};

/** The matches the start will create for one group (none if not of 4). */
export function partiteGirone(girone: GironeAvvio): PartitaAnteprima[] {
  if (girone.giocatori.length !== 4) return [];
  const per = new Map(girone.giocatori.map((g) => [g.lettera, g]));
  const prendi = (lettere: readonly string[]) =>
    lettere.map((l) => per.get(l)).filter((g) => g !== undefined);
  return ROTAZIONE.map(({ turno, a, b }) => ({
    turno,
    squadraA: prendi(a),
    squadraB: prendi(b),
  }));
}

export type RiepilogoAvvio = {
  gironi: number;
  giocatori: number;
  partite: number;
};

export function riepilogoAvvio(
  tabellone: Pick<TabelloneAvvio, "gironi">,
): RiepilogoAvvio {
  return {
    gironi: tabellone.gironi.length,
    giocatori: tabellone.gironi.reduce((n, g) => n + g.giocatori.length, 0),
    partite: tabellone.gironi.reduce((n, g) => n + partiteGirone(g).length, 0),
  };
}

/** Letters A, B, C… in the order `giocatori_girone` uses. */
export function assegnaLettere<
  T extends {
    nome: string;
    cognome: string;
    posto: number | null;
    iscrizioneId: string;
  },
>(giocatori: readonly T[]): (T & { lettera: string })[] {
  return [...giocatori]
    .sort(
      (x, y) =>
        (x.posto ?? Number.POSITIVE_INFINITY) -
          (y.posto ?? Number.POSITIVE_INFINITY) ||
        x.cognome.localeCompare(y.cognome) ||
        x.nome.localeCompare(y.nome) ||
        x.iscrizioneId.localeCompare(y.iscrizioneId),
    )
    .map((g, i) => ({ ...g, lettera: String.fromCharCode(65 + i) }));
}

/** Why the start cannot even be offered, or `null` when it can. */
export function avvioNonDisponibile(
  tabellone: Pick<TabelloneAvvio, "tappa" | "faseGioco">,
): string | null {
  if (tabellone.faseGioco !== null) {
    return "La fase «gironi iniziali» di questo tabellone è già avviata.";
  }
  const { stato } = tabellone.tappa;
  if (stato !== "iscrizioni_chiuse" && stato !== "in_corso") {
    return "La fase si avvia solo dopo la chiusura delle iscrizioni.";
  }
  return null;
}
