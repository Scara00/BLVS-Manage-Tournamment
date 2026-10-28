/**
 * Demo players for w-admin-giocatori / w-admin-giocatore (BLVS-54), used
 * without Supabase env (CI, e2e, local). The players are those of the demo
 * overall standing (their stages played come from it, and a category change
 * moves their points there too), plus the ones e2e creates with
 * `creaGiocatoreDemo()`, which have registrations to future demo stages.
 * One in-memory store per server instance, reset on restart. The change
 * follows the same rules as `admin_cambia_categoria()`.
 */
import type { Categoria, StatoIscrizione, StatoTappa } from "@/lib/db/types";
import type { EffettiRpc } from "@/lib/giocatori/admin/effetti";
import type {
  EffettoAtteso,
  GiocatoreAdmin,
  IscrizioneGiocatore,
} from "@/lib/giocatori/admin/types";
import {
  categoriaAttualeDemo,
  demoGiocatoriClassifica,
  getDemoDatiClassifica,
  impostaCategoriaDemo,
} from "./classifica-generale";

type DemoTappaFutura = {
  id: string;
  nome: string;
  data: string;
  stato: StatoTappa;
  posti: number;
  /** Other players' active registrations per board. */
  occupati: Record<Categoria, number[]>;
};

type DemoIscrizioneFutura = {
  id: string;
  tappaId: string;
  categoria: Categoria;
  posto: number;
  stato: StatoIscrizione;
  inGirone: boolean;
};

type DemoGiocatore = GiocatoreAdmin & {
  /** Only e2e-created players: registrations to future demo stages. */
  future: DemoIscrizioneFutura[];
};

type Store = {
  giocatori: Map<string, DemoGiocatore>;
  tappe: Map<string, DemoTappaFutura>;
  creati: number;
};

const STORE_KEY = Symbol.for("blvs.demo.giocatori-admin");

/** Seeded players whose category is still «da verificare». */
const DA_VERIFICARE = new Set(["demo-u-m-04", "demo-u-m-11", "demo-u-f-03"]);

function email(nome: string, cognome: string): string {
  const parte = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z]+/g, "");
  return `${parte(nome)}.${parte(cognome)}@esempio.it`;
}

function seed(): Store {
  const giocatori = new Map<string, DemoGiocatore>();
  for (const g of demoGiocatoriClassifica()) {
    if (g.anonimo) continue;
    giocatori.set(g.id, {
      id: g.id,
      nome: g.nome,
      cognome: g.cognome,
      email: email(g.nome, g.cognome),
      categoria: categoriaAttualeDemo(g.id) ?? g.categoria,
      ruolo: "giocatore",
      daVerificare: DA_VERIFICARE.has(g.id),
      future: [],
    });
  }
  return { giocatori, tappe: new Map(), creati: 0 };
}

function store(): Store {
  const g = globalThis as unknown as Record<symbol, Store | undefined>;
  return (g[STORE_KEY] ??= seed());
}

function profilo(g: DemoGiocatore): GiocatoreAdmin {
  return {
    id: g.id,
    nome: g.nome,
    cognome: g.cognome,
    email: g.email,
    categoria: g.categoria,
    ruolo: g.ruolo,
    daVerificare: g.daVerificare,
  };
}

/** Every demo player, ordered by surname then name. */
export function demoGiocatoriAdmin(): GiocatoreAdmin[] {
  return [...store().giocatori.values()]
    .map(profilo)
    .sort(
      (a, b) =>
        a.cognome.localeCompare(b.cognome, "it") ||
        a.nome.localeCompare(b.nome, "it") ||
        a.id.localeCompare(b.id),
    );
}

export function demoGiocatoreAdmin(id: string): GiocatoreAdmin | null {
  const g = store().giocatori.get(id);
  return g ? profilo(g) : null;
}

/** Registrations of a demo player: stages played (standing) + future ones. */
export function demoIscrizioniGiocatore(id: string): IscrizioneGiocatore[] {
  const s = store();
  const g = s.giocatori.get(id);
  if (!g) return [];
  const giocate: IscrizioneGiocatore[] = [];
  for (const categoria of ["M", "F"] as const) {
    const dati = getDemoDatiClassifica(categoria, null);
    for (const i of dati.iscrizioni) {
      if (i.utente_id !== id) continue;
      const tappa = dati.tappe.find((t) => t.id === i.tappa_id);
      if (!tappa) continue;
      giocate.push({
        id: i.id,
        tappaId: tappa.id,
        tappa: tappa.nome,
        data: tappa.data_inizio,
        statoTappa: tappa.concluso ? "conclusa" : "in_corso",
        stato: i.stato,
        categoria,
        posto: null,
      });
    }
  }
  const future = g.future.map((f): IscrizioneGiocatore => {
    const tappa = s.tappe.get(f.tappaId)!;
    return {
      id: f.id,
      tappaId: tappa.id,
      tappa: tappa.nome,
      data: tappa.data,
      statoTappa: tappa.stato,
      stato: f.stato,
      categoria: f.categoria,
      posto: f.posto,
    };
  });
  return [...future, ...giocate].sort(
    (a, b) =>
      b.data.localeCompare(a.data) || a.tappaId.localeCompare(b.tappaId),
  );
}

function primoPostoLibero(occupati: readonly number[], posti: number): number {
  for (let n = 1; n <= posti; n++) if (!occupati.includes(n)) return n;
  return Math.max(0, ...occupati) + 1;
}

const ATTIVE: readonly StatoIscrizione[] = ["in_attesa", "confermata"];
const MODIFICABILI: readonly StatoTappa[] = [
  "bozza",
  "iscrizioni_aperte",
  "iscrizioni_chiuse",
];

/** Like `effetti_cambio_categoria()`; null for an unknown player. */
export function demoEffettiCambio(id: string, a: Categoria): EffettiRpc | null {
  const s = store();
  const g = s.giocatori.get(id);
  if (!g) return null;
  const iscrizioni: EffettiRpc["iscrizioni"] = [];
  const bloccanti: EffettiRpc["bloccanti"] = [];
  for (const f of g.future) {
    const tappa = s.tappe.get(f.tappaId)!;
    if (!ATTIVE.includes(f.stato)) continue;
    if (tappa.stato === "in_corso") {
      bloccanti.push({
        tappa_id: tappa.id,
        tappa: tappa.nome,
        data_inizio: tappa.data,
      });
      continue;
    }
    if (f.categoria === a || !MODIFICABILI.includes(tappa.stato)) continue;
    const occupati = tappa.occupati[a];
    iscrizioni.push({
      iscrizione_id: f.id,
      tappa_id: tappa.id,
      tappa: tappa.nome,
      data_inizio: tappa.data,
      stato_tappa: tappa.stato,
      posto_prima: f.posto,
      posto_dopo: primoPostoLibero(occupati, tappa.posti),
      posti: tappa.posti,
      occupati: occupati.length,
      oltre_massimo: occupati.length >= tappa.posti,
      in_girone: f.inGirone,
    });
  }
  // Stages played that are still in progress (the standing's open board).
  for (const i of demoIscrizioniGiocatore(id)) {
    if (i.statoTappa === "in_corso" && !g.future.some((f) => f.id === i.id)) {
      bloccanti.push({
        tappa_id: i.tappaId,
        tappa: i.tappa,
        data_inizio: i.data,
      });
    }
  }
  iscrizioni.sort((x, y) => x.data_inizio.localeCompare(y.data_inizio));
  return { da: g.categoria, a, iscrizioni, bloccanti };
}

export type DemoEsitoCambio =
  | { ok: true; nome: string; spostate: number }
  | {
      ok: false;
      reason:
        | "giocatoreNonTrovato"
        | "stessaCategoria"
        | "tappaInCorso"
        | "effettiCambiati";
      dettaglio?: string;
    };

const firma = (attesi: readonly EffettoAtteso[]) =>
  attesi
    .map((x) => `${x.iscrizione_id}:${x.posto_dopo}`)
    .sort()
    .join(",");

/** Like `admin_cambia_categoria()`. */
export function cambiaCategoriaDemo(
  id: string,
  a: Categoria,
  attesi: readonly EffettoAtteso[],
): DemoEsitoCambio {
  const s = store();
  const g = s.giocatori.get(id);
  const effetti = demoEffettiCambio(id, a);
  if (!g || !effetti) return { ok: false, reason: "giocatoreNonTrovato" };
  if (g.categoria === a) return { ok: false, reason: "stessaCategoria" };
  if (effetti.bloccanti.length > 0) {
    return {
      ok: false,
      reason: "tappaInCorso",
      dettaglio: effetti.bloccanti[0].tappa,
    };
  }
  const attuali = effetti.iscrizioni.map((i) => ({
    iscrizione_id: i.iscrizione_id,
    posto_dopo: i.posto_dopo,
  }));
  if (firma(attuali) !== firma(attesi)) {
    return { ok: false, reason: "effettiCambiati" };
  }
  for (const e of effetti.iscrizioni) {
    const f = g.future.find((x) => x.id === e.iscrizione_id)!;
    const tappa = s.tappe.get(f.tappaId)!;
    tappa.occupati[a] = [...tappa.occupati[a], e.posto_dopo];
    f.categoria = a;
    f.posto = e.posto_dopo;
    f.inGirone = false;
  }
  g.categoria = a;
  g.daVerificare = false;
  impostaCategoriaDemo(id, a);
  return {
    ok: true,
    nome: `${g.nome} ${g.cognome}`.trim(),
    spostate: effetti.iscrizioni.length,
  };
}

/** Like `admin_verifica_categoria()`. */
export function verificaCategoriaDemo(id: string): boolean {
  const g = store().giocatori.get(id);
  if (!g || !g.categoria) return false;
  g.daVerificare = false;
  return true;
}

/**
 * e2e fixture: a fresh men's player «Prova<N> Cambio», category to verify,
 * registered to two future stages: on «Tappa demo N · Lignano» the women's
 * board is full (the move goes past the maximum), on «Tappa demo N ·
 * Sabaudia» he is already in a proposed group. `inCorso` adds a stage in
 * progress, which blocks the change.
 */
export function creaGiocatoreDemo({
  inCorso = false,
}: { inCorso?: boolean } = {}): { utenteId: string; nome: string } {
  const s = store();
  const n = ++s.creati;
  const id = `demo-u-e2e-${String(n).padStart(3, "0")}`;
  const anno = 2027 + Math.floor(n / 100);
  const tappe: DemoTappaFutura[] = [
    {
      id: `demo-e2e-${n}-lignano`,
      nome: `Tappa demo ${n} · Lignano`,
      data: `${anno}-07-04`,
      stato: "iscrizioni_aperte",
      posti: 16,
      occupati: {
        M: [1, 2, 3, 4, 5, 6, 8, 9],
        F: Array.from({ length: 16 }, (_, i) => i + 1),
      },
    },
    {
      id: `demo-e2e-${n}-sabaudia`,
      nome: `Tappa demo ${n} · Sabaudia`,
      data: `${anno}-07-18`,
      stato: "iscrizioni_chiuse",
      posti: 16,
      occupati: { M: [1, 2, 4], F: [1, 2, 3, 4, 5] },
    },
  ];
  if (inCorso) {
    tappe.push({
      id: `demo-e2e-${n}-rimini`,
      nome: `Tappa demo ${n} · Rimini`,
      data: `${anno}-06-20`,
      stato: "in_corso",
      posti: 16,
      occupati: { M: [1, 2], F: [1] },
    });
  }
  for (const t of tappe) s.tappe.set(t.id, t);
  const future: DemoIscrizioneFutura[] = [
    {
      id: `${id}-lignano`,
      tappaId: tappe[0].id,
      categoria: "M",
      posto: 7,
      stato: "confermata",
      inGirone: false,
    },
    {
      id: `${id}-sabaudia`,
      tappaId: tappe[1].id,
      categoria: "M",
      posto: 3,
      stato: "confermata",
      inGirone: true,
    },
    ...(inCorso
      ? [
          {
            id: `${id}-rimini`,
            tappaId: tappe[2].id,
            categoria: "M" as const,
            posto: 3,
            stato: "confermata" as const,
            inGirone: true,
          },
        ]
      : []),
  ];
  const nome = `Prova${n}`;
  s.giocatori.set(id, {
    id,
    nome,
    cognome: "Cambio",
    email: `prova${n}.cambio@esempio.it`,
    categoria: "M",
    ruolo: "giocatore",
    daVerificare: true,
    future,
  });
  return { utenteId: id, nome: `${nome} Cambio` };
}
