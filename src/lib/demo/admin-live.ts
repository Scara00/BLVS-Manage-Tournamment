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
import { getDemoAvvioFase } from "./avvio-fase";

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
  const tabellone = getDemoAvvioFase(tappaId, categoria);
  if (!tabellone) return [];
  const ritocchi = RITOCCHI[chiaveTabellone(tappaId, categoria)] ?? {};
  return tabellone.gironi.flatMap((girone, i) =>
    partiteGirone(girone).map((p): PartitaLive => {
      const id = `${girone.id}-t${p.turno}`;
      const giocatore = ({
        iscrizioneId,
        nome,
        cognome,
      }: (typeof p.squadraA)[number]) => ({ iscrizioneId, nome, cognome });
      return {
        id,
        fase: "gironi",
        gironeId: girone.id,
        gironeNome: girone.nome,
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
  if (!partite && tabellone.faseGioco !== null) {
    partite = creaPartite(tappaId, categoria);
    store().set(chiave, partite);
  }
  return {
    tappa: tabellone.tappa,
    categoria,
    faseGioco: tabellone.faseGioco,
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
): EsitoModifica {
  const trovata = trova(tappaId, categoria, partitaId);
  if ("esito" in trovata) return trovata.esito;
  const { partita } = trovata;
  if (partita.versione !== versione) return { ok: false, motivo: "conflict" };
  const chiude = concludi || partita.stato === "conclusa";
  if (chiude && !vincitore(sets))
    return { ok: false, motivo: "senzaVincitore" };
  if (concludi && partita.stato !== "in_corso") {
    return { ok: false, motivo: "conflict" };
  }
  partita.sets = [...sets];
  partita.versione = versione + 1;
  if (concludi) partita.stato = "conclusa";
  return { ok: true, partita: copia(partita) };
}
