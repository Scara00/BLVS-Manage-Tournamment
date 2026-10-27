import type { TipoEventoRegistro, ValoreRegistro } from "@/lib/audit";
import { applicaFiltri } from "@/lib/registro/filtri";
import type {
  FiltriRegistro,
  PartitaFiltroDb,
  PartitaRegistroDb,
  VoceRegistroDb,
} from "@/lib/registro/types";
import { romeStartOfDay, romeToday } from "@/lib/time/rome-local";
import { now } from "@/lib/time/server-time";
import { getDemoTappaGestione } from "./gestione-tappe";

/**
 * The race log of the demo stages (no Supabase env: CI, e2e). Read-only and
 * deterministic: the in-progress stage «jesolo» has entries over today,
 * yesterday and three days ago, every other stage has none (empty state).
 * Times are relative to now, so «Oggi» always appears.
 */

const STAGE_CON_VOCI = "jesolo";

const PARTITE: Record<string, PartitaRegistroDb> = {
  "0d1f0c4e-5a0b-4c1e-9a10-000000000001": {
    categoria: "M",
    fase: "gironi",
    girone: "Girone A",
    turno: 1,
    squadra_a: ["Luca Rossi", "Marco Bianchi"],
    squadra_b: ["Andrea Ferrari", "Matteo Russo"],
  },
  "0d1f0c4e-5a0b-4c1e-9a10-000000000002": {
    categoria: "M",
    fase: "gironi",
    girone: "Girone A",
    turno: 2,
    squadra_a: ["Luca Rossi", "Andrea Ferrari"],
    squadra_b: ["Marco Bianchi", "Matteo Russo"],
  },
  "0d1f0c4e-5a0b-4c1e-9a10-000000000003": {
    categoria: "F",
    fase: "gironi",
    girone: "Girone B",
    turno: 1,
    squadra_a: ["Giulia Conti", "Chiara Greco"],
    squadra_b: ["Sara Marino", "Francesca Gallo"],
  },
  "0d1f0c4e-5a0b-4c1e-9a10-000000000004": {
    categoria: "F",
    fase: "gironi",
    girone: "Girone B",
    turno: 2,
    squadra_a: ["Giulia Conti", "Sara Marino"],
    squadra_b: ["Chiara Greco", "Francesca Gallo"],
  },
};
const [P1, P2, P3, P4] = Object.keys(PARTITE);

const ADMIN = ["Paola Arbitri", "Giorgio Tavoli"];

type Evento = {
  tipo: TipoEventoRegistro;
  partita?: string;
  prima?: ValoreRegistro;
  dopo?: ValoreRegistro;
  nota?: string;
};

const set = (a: number, b: number) => ({ sets: [{ a, b }] });

/** The events of one day, oldest first. */
function giornata(giorno: number): Evento[] {
  const eventi: Evento[] = [];
  const partite = [P1, P2, P3, P4];
  partite.forEach((partita, i) => {
    const a = 21;
    const b = 12 + ((i + giorno) % 8);
    eventi.push({ tipo: "inserimento_punteggio", partita, dopo: set(a, b) });
    if ((i + giorno) % 2 === 0) {
      eventi.push({
        tipo: "correzione_punteggio",
        partita,
        prima: set(a, b),
        dopo: set(a, b + 1),
        nota: "Errore di battitura sul tabellone",
      });
    }
    eventi.push({
      tipo: "inserimento_punteggio",
      partita,
      dopo: set(b + 2, 21 + (i % 2) * 2),
    });
  });
  eventi.push({
    tipo: "annullamento_punteggio",
    partita: P2,
    prima: set(21, 17),
    nota: "Partita da rigiocare",
  });
  eventi.push({
    tipo: "parita_risolta",
    prima: null,
    dopo: { girone: "Girone A", ordine: ["Luca Rossi", "Marco Bianchi"] },
    nota: "Sorteggio in campo",
  });
  return eventi;
}

function eventiTappa(): Evento[][] {
  const tre: Evento[] = [
    {
      tipo: "rigenerazione_gironi",
      prima: {
        gironi: [
          { nome: "Girone A" },
          { nome: "Girone B" },
          { nome: "Girone C" },
        ],
        punteggi_persi: 2,
      },
      dopo: { categoria: "M", gironi: 4, partite: 12, punteggi_persi: 2 },
      nota: "Rigenerazione con 2 punteggi persi",
    },
    {
      tipo: "cambio_categoria",
      prima: { categoria: "M" },
      dopo: { categoria: "F" },
      nota: "Categoria corretta su richiesta",
    },
    ...giornata(3),
  ];
  const ieri: Evento[] = [
    ...giornata(1),
    { tipo: "ritiro", nota: "Infortunio alla caviglia" },
  ];
  const oggi = giornata(0).slice(0, 12);
  // Oldest day first.
  return [tre, ieri, oggi];
}

type VoceAggiunta = {
  tipo: TipoEventoRegistro;
  autore: string;
  prima: ValoreRegistro | null;
  dopo: ValoreRegistro | null;
  nota: string | null;
  created_at: string;
};

const AGGIUNTE_KEY = Symbol.for("blvs.demo.registro.aggiunte");

/** Entries written by demo actions (e.g. BLVS-38's decisions), per stage. */
function aggiunte(): Map<string, VoceAggiunta[]> {
  const g = globalThis as unknown as Record<
    symbol,
    Map<string, VoceAggiunta[]> | undefined
  >;
  return (g[AGGIUNTE_KEY] ??= new Map());
}

/** Ids of written entries start here, above every seeded one. */
const PRIMO_ID_AGGIUNTO = 100_000;

/**
 * Logs an event of a demo action, as `registra_evento` would. It shows on
 * top of the stage's log (newest first).
 */
export function aggiungiVoceDemoRegistro(
  tappaId: string,
  voce: Omit<VoceAggiunta, "created_at">,
): void {
  const elenco = aggiunte().get(tappaId) ?? [];
  elenco.push({ ...voce, created_at: now().toISOString() });
  aggiunte().set(tappaId, elenco);
}

function vociAggiunte(
  tappaId: string,
): (VoceRegistroDb & { partitaId: string | null })[] {
  return (aggiunte().get(tappaId) ?? [])
    .map((v, i) => ({
      id: PRIMO_ID_AGGIUNTO + i,
      tipo: v.tipo,
      created_at: v.created_at,
      autore: v.autore,
      partita_id: null,
      partita: null,
      partitaId: null,
      valore_prima: v.prima,
      valore_dopo: v.dopo,
      nota: v.nota,
      totale: 0,
    }))
    .reverse();
}

function giornoDa(oggi: string, indietro: number): string {
  const data = new Date(`${oggi}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() - indietro);
  return data.toISOString().slice(0, 10);
}

/** Every entry of the demo stage, newest first. */
function vociTappa(
  tappaId: string,
): (VoceRegistroDb & { partitaId: string | null })[] {
  if (tappaId !== STAGE_CON_VOCI) return vociAggiunte(tappaId);
  const adesso = now();
  const oggi = romeToday(adesso);
  const [tre, ieri, oggiEventi] = eventiTappa();
  const giorni: [number, Evento[]][] = [
    [3, tre],
    [1, ieri],
    [0, oggiEventi],
  ];
  const voci: (VoceRegistroDb & { partitaId: string | null })[] = [];
  let id = 1;
  for (const [indietro, eventi] of giorni) {
    const inizio = romeStartOfDay(giornoDa(oggi, indietro))!.getTime();
    // Today the entries fit between midnight and now; other days from 9:00.
    const da = indietro === 0 ? inizio : inizio + 9 * 3_600_000;
    const fine = indietro === 0 ? adesso.getTime() : inizio + 19 * 3_600_000;
    const passo = (fine - da) / (eventi.length + 1);
    eventi.forEach((evento, i) => {
      voci.push({
        id,
        tipo: evento.tipo,
        created_at: new Date(Math.round(da + passo * (i + 1))).toISOString(),
        autore: ADMIN[id % ADMIN.length],
        partita_id: evento.partita ?? null,
        partita: evento.partita ? PARTITE[evento.partita] : null,
        partitaId: evento.partita ?? null,
        valore_prima: evento.prima ?? null,
        valore_dopo: evento.dopo ?? null,
        nota: evento.nota ?? null,
        totale: 0,
      });
      id++;
    });
  }
  return [...vociAggiunte(tappaId), ...voci.reverse()];
}

export type DemoRegistro = {
  tappa: { id: string; nome: string };
  rows: VoceRegistroDb[];
  partite: PartitaFiltroDb[];
};

/** Same paging as `registro_tappa()`; null for an unknown stage. */
export function demoRegistroTappa(
  tappaId: string,
  filtri: FiltriRegistro,
  primaDi: number | null,
  limite: number,
): DemoRegistro | null {
  const tappa = getDemoTappaGestione(tappaId);
  if (!tappa) return null;
  const tutte = vociTappa(tappaId);
  const filtrate = applicaFiltri(tutte, filtri).filter(
    (v) => primaDi === null || Number(v.id) < primaDi,
  );
  const rows = filtrate.slice(0, limite).map((v) => {
    const riga: VoceRegistroDb & { partitaId?: string | null } = {
      ...v,
      totale: filtrate.length,
    };
    delete riga.partitaId;
    return riga;
  });
  const partite = [
    ...new Set(tutte.flatMap((v) => (v.partitaId ? [v.partitaId] : []))),
  ].map((id) => ({ partita_id: id, partita: PARTITE[id] ?? null }));
  return {
    tappa: { id: tappa.row.id, nome: tappa.row.nome },
    rows,
    partite,
  };
}
