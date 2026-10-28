import type {
  Categoria,
  FaseGioco,
  FaseGirone,
  StatoTappa,
} from "@/lib/db/types";
import { coloreGirone, livelloGirone } from "@/lib/gironi/fasi/fase";
import {
  classificaGirone,
  type ClassificaGirone,
} from "@/lib/gironi/classifica/classifica";
import {
  toPartitaGirone,
  type PartitaGironeRow,
} from "@/lib/gironi/classifica/dati";
import { noteAssenze } from "@/lib/ritiri/format";
import type { TipoRitiro } from "@/lib/ritiri/types";
import { faseCorrente, ORDINE_LIVELLI } from "./fasi";
import { taglioGirone } from "./taglio";
import type {
  BoardTabellone,
  GironeTabellone,
  RigaTabellone,
  StageBoard,
  StatoGironeTabellone,
} from "./types";

/** One group as read, with its standing already computed (BLVS-27). */
export type GironeDati = {
  id: string;
  nome: string;
  fase: FaseGirone;
  categoria: Categoria;
  /** Registration ids of its players, shown even before any match. */
  giocatori: readonly string[];
  /** Null when the group has no match yet. */
  classifica: ClassificaGirone | null;
};

/** What w-tabellone is computed from: the DB read or the demo stores. */
export type DatiTabellone = {
  tappa: { id: string; nome: string; stato: StatoTappa };
  tabelloni: readonly {
    categoria: Categoria;
    faseGioco: FaseGioco | null;
    conclusoIl: string | null;
  }[];
  gironi: readonly GironeDati[];
  /** «Nome Cognome» by registration id. */
  nomi: ReadonlyMap<string, string>;
  /** BLVS-42 standing notes by registration id. */
  note: ReadonlyMap<string, string>;
};

const nomi = new Intl.Collator("it", { sensitivity: "base" });

function righe(girone: GironeDati, dati: DatiTabellone): RigaTabellone[] {
  const nome = (id: string) => dati.nomi.get(id) ?? id;
  const nota = (id: string) =>
    dati.note.get(id) ? { note: dati.note.get(id) } : {};
  const giocato = girone.classifica?.righe.some((r) => r.giocate > 0) ?? false;
  if (!girone.classifica || !giocato) {
    const ids = new Set([
      ...girone.giocatori,
      ...(girone.classifica?.righe.map((r) => r.iscrizioneId) ?? []),
    ]);
    return [...ids]
      .sort((a, b) => nomi.compare(nome(a), nome(b)))
      .map((id) => ({
        playerId: id,
        name: nome(id),
        position: null,
        pari: false,
        ...nota(id),
        played: 0,
        won: 0,
        diff: 0,
        points: 0,
      }));
  }
  const inClassifica = new Set(
    girone.classifica.righe.map((r) => r.iscrizioneId),
  );
  const ultimo = girone.classifica.righe.length;
  return [
    ...girone.classifica.righe.map((r) => ({
      playerId: r.iscrizioneId,
      name: nome(r.iscrizioneId),
      position: r.posizione,
      pari: r.daRisolvere,
      ...nota(r.iscrizioneId),
      played: r.giocate,
      won: r.vinte,
      diff: r.differenza,
      points: r.puntiFatti,
    })),
    // A member with no match at all (e.g. placed after the start).
    ...girone.giocatori
      .filter((id) => !inClassifica.has(id))
      .map((id) => ({
        playerId: id,
        name: nome(id),
        position: ultimo + 1,
        pari: false,
        ...nota(id),
        played: 0,
        won: 0,
        diff: 0,
        points: 0,
      })),
  ];
}

function stato(girone: GironeDati): StatoGironeTabellone {
  const c = girone.classifica;
  if (!c || !c.righe.some((r) => r.giocate > 0)) return "da_giocare";
  return c.stato === "in_corso" ? "in_corso" : "completo";
}

/** Everything w-tabellone shows, from the data of one stage. */
export function vistaTabellone(
  dati: DatiTabellone,
  { change = null, updatedAt }: { change?: string | null; updatedAt: string },
): StageBoard {
  const boards: BoardTabellone[] = dati.tabelloni.map((t) => {
    const delBoard = dati.gironi.filter((g) => g.categoria === t.categoria);
    const perColore = (fase: FaseGirone) =>
      delBoard.filter((g) => g.fase === fase).length;
    const gironi: GironeTabellone[] = delBoard
      .map((g) => ({
        id: g.id,
        nome: g.nome,
        fase: g.fase,
        livello: livelloGirone(g.fase),
        colore: coloreGirone(g.fase),
        stato: stato(g),
        taglio: taglioGirone(g.fase, perColore(g.fase)),
        rows: righe(g, dati),
      }))
      .map((g, i) => ({ g, i }))
      .sort(
        (a, b) =>
          ORDINE_LIVELLI.indexOf(a.g.livello) -
            ORDINE_LIVELLI.indexOf(b.g.livello) || a.i - b.i,
      )
      .map(({ g }) => g);
    return {
      categoria: t.categoria,
      faseGioco: t.faseGioco,
      conclusoIl: t.conclusoIl,
      fase: faseCorrente(t.faseGioco, t.conclusoIl),
      gironi,
    };
  });
  return {
    id: dati.tappa.id,
    stageId: dati.tappa.id,
    label: dati.tappa.nome,
    statoTappa: dati.tappa.stato,
    boards,
    change,
    updatedAt,
  };
}

/** The jsonb of `public.tabellone_giocatore_dati(p_tappa)`. */
export type RpcTabellone = {
  tappa: { id: string; nome: string; stato: StatoTappa };
  tabelloni: {
    id: string;
    categoria: Categoria;
    fase_gioco: FaseGioco | null;
    concluso_il: string | null;
  }[];
  gironi: {
    id: string;
    tabellone_id: string;
    nome: string;
    posizione: number;
    fase: FaseGirone;
  }[];
  membri: { girone_id: string; iscrizione_id: string }[];
  partite: (PartitaGironeRow & { girone_id: string })[];
  decisioni: { girone_id: string; firma: string; ordine: string[] }[];
  nomi: { iscrizione_id: string; nome: string; cognome: string }[];
  assenze: { partita_id: string; iscrizione_id: string; tipo: TipoRitiro }[];
};

/**
 * The RPC's raw rows to `DatiTabellone`: each group's standing computed
 * like BLVS-27 (with the stored tie decisions). A group's players are its
 * members plus anyone in its matches, so a withdrawn player removed from
 * the group still shows (as BLVS-40 does).
 */
export function datiDaRpc(rpc: RpcTabellone): DatiTabellone {
  const categoria = new Map(rpc.tabelloni.map((t) => [t.id, t.categoria]));
  const gironi: GironeDati[] = rpc.gironi.flatMap((g) => {
    const cat = categoria.get(g.tabellone_id);
    if (!cat) return [];
    const partite = rpc.partite
      .filter((p) => p.girone_id === g.id)
      .map(toPartitaGirone);
    const giocatori = [
      ...new Set([
        ...rpc.membri
          .filter((m) => m.girone_id === g.id)
          .map((m) => m.iscrizione_id),
        ...partite.flatMap((p) => [...p.squadre.A, ...p.squadre.B]),
      ]),
    ].sort();
    return [
      {
        id: g.id,
        nome: g.nome,
        fase: g.fase,
        categoria: cat,
        giocatori,
        classifica:
          partite.length === 0
            ? null
            : classificaGirone(giocatori, partite, {
                decisioni: rpc.decisioni.filter((d) => d.girone_id === g.id),
              }),
      },
    ];
  });
  return {
    tappa: rpc.tappa,
    tabelloni: rpc.tabelloni.map((t) => ({
      categoria: t.categoria,
      faseGioco: t.fase_gioco,
      conclusoIl: t.concluso_il,
    })),
    gironi,
    nomi: new Map(
      rpc.nomi.map((n) => [n.iscrizione_id, `${n.nome} ${n.cognome}`.trim()]),
    ),
    note: noteAssenze(
      rpc.assenze.map((a) => ({
        partitaId: a.partita_id,
        iscrizioneId: a.iscrizione_id,
        tipo: a.tipo,
      })),
    ),
  };
}
