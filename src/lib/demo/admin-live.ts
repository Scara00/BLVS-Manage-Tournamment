import type { Categoria, SetPunteggio, StatoPartita } from "@/lib/db/types";
import { partiteGirone } from "@/lib/tappe/avvio/regole";
import type { EsitoModifica } from "@/lib/tappe/live-admin/dati";
import { vincitore } from "@/lib/tappe/live-admin/format";
import type { OperazionePartita } from "@/lib/tappe/live-admin/state";
import {
  chiaveTabellone,
  type PartitaLive,
  type TabelloneLive,
} from "@/lib/tappe/live-admin/types";
import { now } from "@/lib/time/server-time";
import {
  classificaTappa,
  type ClassificaTappa,
  type FinaleTappa,
} from "@/lib/tappe/classifica/classifica";
import { bloccoChiusura, finaliDaPartite } from "@/lib/tappe/chiusura/regole";
import type { BloccoChiusura } from "@/lib/tappe/chiusura/regole";
import { getDemoAvvioFase, getDemoGironiGiocati } from "./avvio-fase";
import { segnaTappaConclusaDemo } from "./gestione-tappe";
import { aggiungiVoceDemoRegistro } from "./registro";
import { getDemoDecisioni } from "./spareggi";

/**
 * Matches of the started demo boards for w-admin-live when Supabase is not
 * configured (CI, e2e). They are made on first read from the groups of the
 * start screen's demo store, like `avvia_fase` does. One server instance,
 * reset on restart, like the other demo stores.
 */
type Store = Map<string, PartitaLive[]>;

const STORE_KEY = Symbol.for("blvs.demo.adminLive");

function store(): Store {
  const g = globalThis as unknown as Record<symbol, Store | undefined>;
  return (g[STORE_KEY] ??= new Map());
}

/** BLVS-43: when each demo board was concluded (`tabelloni.concluso_il`). */
const CHIUSI_KEY = Symbol.for("blvs.demo.adminLive.chiusi");

function chiusi(): Map<string, string> {
  const g = globalThis as unknown as Record<
    symbol,
    Map<string, string> | undefined
  >;
  return (g[CHIUSI_KEY] ??= new Map());
}

/** When a demo board was concluded, or null while it is open. */
export function getDemoConclusoIl(
  tappaId: string,
  categoria: Categoria,
): string | null {
  return chiusi().get(chiaveTabellone(tappaId, categoria)) ?? null;
}

type Ritocco = { stato: StatoPartita; sets?: SetPunteggio[] };

/** Tappa 1 · Jesolo is mid-race: a few matches played or being played. */
const RITOCCHI: Record<string, Record<string, Ritocco>> = {
  "jesolo:M": {
    "jesolo-M-g1-t1": {
      stato: "conclusa",
      sets: [
        { a: 21, b: 18 },
        { a: 21, b: 15 },
      ],
    },
    "jesolo-M-g1-t2": { stato: "in_corso" },
    "jesolo-M-g2-t1": { stato: "in_corso", sets: [{ a: 21, b: 19 }] },
  },
  "jesolo:F": {
    "jesolo-F-g1-t1": {
      stato: "conclusa",
      sets: [
        { a: 18, b: 21 },
        { a: 21, b: 17 },
        { a: 15, b: 12 },
      ],
    },
    "jesolo-F-g1-t2": { stato: "in_corso" },
  },
};

function creaPartite(tappaId: string, categoria: Categoria): PartitaLive[] {
  const ritocchi = RITOCCHI[chiaveTabellone(tappaId, categoria)] ?? {};
  return getDemoGironiGiocati(tappaId, categoria).flatMap((girone, i) =>
    partiteGirone(girone).map((p): PartitaLive => {
      const id = `${girone.id}-t${p.turno}`;
      const giocatore = ({
        iscrizioneId,
        nome,
        cognome,
      }: (typeof p.squadraA)[number]) => ({ iscrizioneId, nome, cognome });
      return {
        id,
        fase: girone.fase?.startsWith("finale") ? "finale" : "gironi",
        gironeId: girone.id,
        gironeNome: girone.nome,
        gironeFase: girone.fase ?? "iniziale",
        gironePosizione: i + 1,
        turno: p.turno,
        campo: `Campo ${(i % 4) + 1}`,
        programmataIl: null,
        stato: ritocchi[id]?.stato ?? "programmata",
        squadraA: p.squadraA.map(giocatore),
        squadraB: p.squadraB.map(giocatore),
        sets: ritocchi[id]?.sets ?? [],
        versione: ritocchi[id]?.sets ? 2 : 1,
      };
    }),
  );
}

/** The live list of one board: null for an unknown stage. */
export function getDemoTabelloneLive(
  tappaId: string,
  categoria: Categoria,
  adesso: Date,
): TabelloneLive | null {
  const tabellone = getDemoAvvioFase(tappaId, categoria);
  if (!tabellone) return null;
  const chiave = chiaveTabellone(tappaId, categoria);
  let partite = store().get(chiave);
  if (tabellone.faseGioco !== null) {
    // A later phase (BLVS-39) adds its matches to those already played.
    const nuove = creaPartite(tappaId, categoria).filter(
      (p) => !partite?.some((q) => q.id === p.id),
    );
    if (!partite || nuove.length > 0) {
      partite = [...(partite ?? []), ...nuove];
      store().set(chiave, partite);
    }
  }
  return {
    tappa: tabellone.tappa,
    categoria,
    tabelloneId: chiave,
    faseGioco: tabellone.faseGioco,
    conclusoIl: chiusi().get(chiave) ?? null,
    partite: (partite ?? []).map((p) => ({ ...p, sets: [...p.sets] })),
    lettoIl: adesso.toISOString(),
  };
}

function trova(
  tappaId: string,
  categoria: Categoria,
  partitaId: string,
): { partita: PartitaLive } | { esito: EsitoModifica } {
  const letto = getDemoTabelloneLive(tappaId, categoria, now());
  if (!letto) return { esito: { ok: false, motivo: "nonTrovata" } };
  const { stato } = letto.tappa;
  if (stato === "archiviata" || stato === "annullata") {
    return { esito: { ok: false, motivo: "tappaChiusa" } };
  }
  const partita = store()
    .get(chiaveTabellone(tappaId, categoria))
    ?.find((p) => p.id === partitaId);
  return partita ? { partita } : { esito: { ok: false, motivo: "nonTrovata" } };
}

const copia = (p: PartitaLive): PartitaLive => ({ ...p, sets: [...p.sets] });

/** Same rules as `cambiaStatoDb`. */
export function cambiaStatoDemo(
  tappaId: string,
  categoria: Categoria,
  partitaId: string,
  operazione: OperazionePartita,
): EsitoModifica {
  const trovata = trova(tappaId, categoria, partitaId);
  if ("esito" in trovata) return trovata.esito;
  const { partita } = trovata;
  const [da, a]: [StatoPartita, StatoPartita] =
    operazione === "inizia"
      ? ["programmata", "in_corso"]
      : ["in_corso", "conclusa"];
  if (partita.stato !== da) return { ok: false, motivo: "conflict" };
  if (operazione === "concludi" && !vincitore(partita.sets)) {
    return { ok: false, motivo: "senzaVincitore" };
  }
  partita.stato = a;
  return { ok: true, partita: copia(partita) };
}

/** Same rules as `salvaPunteggioDb`. */
export function salvaPunteggioDemo(
  tappaId: string,
  categoria: Categoria,
  partitaId: string,
  versione: number,
  sets: SetPunteggio[],
  concludi: boolean,
  /** BLVS-43: the admin confirmed a correction on a concluded board. */
  confermaConcluso = false,
): EsitoModifica {
  const trovata = trova(tappaId, categoria, partitaId);
  if ("esito" in trovata) return trovata.esito;
  const { partita } = trovata;
  if (getDemoConclusoIl(tappaId, categoria) !== null && !confermaConcluso) {
    return { ok: false, motivo: "tabelloneConcluso" };
  }
  if (partita.versione !== versione) return { ok: false, motivo: "conflict" };
  const chiude = concludi || partita.stato === "conclusa";
  if (chiude && !vincitore(sets))
    return { ok: false, motivo: "senzaVincitore" };
  if (concludi && partita.stato !== "in_corso") {
    return { ok: false, motivo: "conflict" };
  }
  const prima = { sets: partita.sets, versione: partita.versione };
  partita.sets = [...sets];
  partita.versione = versione + 1;
  if (concludi) partita.stato = "conclusa";
  if (confermaConcluso) {
    // BLVS-43: like `correggi_tabellone_concluso`, in the registro.
    aggiungiVoceDemoRegistro(tappaId, {
      tipo: "correzione_punteggio",
      autore: "Amministrazione demo",
      prima: { ...prima, sets: [...prima.sets], tappa_id: tappaId },
      dopo: { sets: [...sets], versione: versione + 1, tappa_id: tappaId },
      nota: "Correzione su tabellone concluso",
    });
  }
  return { ok: true, partita: copia(partita) };
}

/** The finals of a demo board, with the demo tie decisions (BLVS-38). */
export function finaliTappaDemo(
  tappaId: string,
  categoria: Categoria,
): { finali: FinaleTappa[]; concluso: boolean } | null {
  const letto = getDemoTabelloneLive(tappaId, categoria, now());
  if (!letto) return null;
  return {
    finali: finaliDaPartite(letto.partite, getDemoDecisioni),
    concluso: letto.conclusoIl !== null,
  };
}

/** The stage standing of a demo board (BLVS-40), computed on read. */
export function classificaTappaDemo(
  tappaId: string,
  categoria: Categoria,
): ClassificaTappa | null {
  const dati = finaliTappaDemo(tappaId, categoria);
  return dati ? classificaTappa(dati) : null;
}

export type DemoChiusuraEsito =
  | { ok: true; conclusoIl: string; tappaConclusa: boolean }
  | { ok: false; blocco: BloccoChiusura }
  | { ok: false; motivo: "nonTrovata" | "tappaArchiviata" };

/** Same rules and effects as `concludi_tabellone` (BLVS-43). */
export function concludiTabelloneDemo(
  tappaId: string,
  categoria: Categoria,
  at: Date,
): DemoChiusuraEsito {
  const letto = getDemoTabelloneLive(tappaId, categoria, at);
  if (!letto) return { ok: false, motivo: "nonTrovata" };
  if (letto.tappa.stato === "archiviata") {
    return { ok: false, motivo: "tappaArchiviata" };
  }
  const blocco = bloccoChiusura({
    statoTappa: letto.tappa.stato,
    faseGioco: letto.faseGioco,
    conclusoIl: letto.conclusoIl,
    partite: letto.partite,
    classifica: classificaTappaDemo(tappaId, categoria),
  });
  if (blocco) return { ok: false, blocco };
  const conclusoIl = at.toISOString();
  chiusi().set(chiaveTabellone(tappaId, categoria), conclusoIl);
  aggiungiVoceDemoRegistro(tappaId, {
    tipo: "chiusura_tabellone",
    autore: "Amministrazione demo",
    prima: { tappa_id: tappaId, concluso_il: null },
    dopo: {
      tappa_id: tappaId,
      categoria,
      concluso_il: conclusoIl,
      punti: (classificaTappaDemo(tappaId, categoria)?.righe ?? []).map(
        (r) => ({
          iscrizioneId: r.iscrizioneId,
          nome: r.nome,
          posizione: r.posizione,
          punti: r.punti,
        }),
      ),
    },
    nota: null,
  });
  const tappaConclusa = (["M", "F"] as const).every(
    (c) => getDemoConclusoIl(tappaId, c) !== null,
  );
  if (tappaConclusa) segnaTappaConclusaDemo(tappaId);
  return { ok: true, conclusoIl, tappaConclusa };
}

/** Concludes a demo match with `sets` (BLVS-43 e2e fixtures). */
export function impostaRisultatoLiveDemo(
  tappaId: string,
  categoria: Categoria,
  partitaId: string,
  sets: SetPunteggio[],
  stato: StatoPartita = "conclusa",
) {
  getDemoTabelloneLive(tappaId, categoria, now());
  const partita = store()
    .get(chiaveTabellone(tappaId, categoria))
    ?.find((p) => p.id === partitaId);
  if (!partita) return;
  partita.sets = [...sets];
  partita.stato = stato;
  partita.versione += 1;
}
