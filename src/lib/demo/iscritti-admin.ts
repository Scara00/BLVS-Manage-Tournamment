import type { Categoria, StatoIscrizione } from "@/lib/db/types";
import { iscrittiModificabili } from "@/lib/iscrizioni/admin/format";
import type {
  GiocatoreTrovato,
  IscrittoRow,
  TabelloneIscrittiRow,
  TappaIscrittiRow,
} from "@/lib/iscrizioni/admin/types";
import { POSTI_PREDEFINITI } from "@/lib/tappe/nuova/types";
import { aggiornaContiDemo, getDemoTappaGestione } from "./gestione-tappe";

/**
 * Registrants of the demo stages (no Supabase env: CI, e2e), on top of the
 * stage store of BLVS-20. A stage's list is generated on first read from
 * the board counts of that store, then kept in memory (one server
 * instance, reset on restart) and its counts written back. Adding and
 * removing follow the same rules as `admin_iscrivi_giocatore()` and
 * `admin_rimuovi_iscrizione()`.
 */

type DemoGiocatore = {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  categoria: Categoria | null;
};

type DemoIscrizione = IscrittoRow & { utenteId: string };

const NOMI: Record<Categoria, readonly string[]> = {
  M: [
    "Luca",
    "Marco",
    "Andrea",
    "Matteo",
    "Davide",
    "Simone",
    "Federico",
    "Nicolò",
    "Riccardo",
    "Tommaso",
    "Gabriele",
    "Lorenzo",
    "Alessio",
    "Filippo",
    "Stefano",
    "Edoardo",
    "Pietro",
    "Mattia",
    "Giacomo",
    "Emanuele",
    "Jacopo",
    "Fabio",
  ],
  F: [
    "Giulia",
    "Chiara",
    "Francesca",
    "Sara",
    "Martina",
    "Elena",
    "Alessia",
    "Valentina",
    "Federica",
    "Beatrice",
    "Noemi",
    "Ilaria",
    "Arianna",
    "Camilla",
    "Gaia",
    "Sofia",
    "Aurora",
    "Benedetta",
  ],
};

const COGNOMI = [
  "Rossi",
  "Bianchi",
  "Ferrari",
  "Esposito",
  "Romano",
  "Colombo",
  "Ricci",
  "Marino",
  "Greco",
  "Bruno",
  "Gallo",
  "Conti",
  "De Luca",
  "Mancini",
  "Costa",
  "Giordano",
  "Rizzo",
  "Lombardi",
  "Moretti",
  "Barbieri",
  "Fontana",
  "Santoro",
];

function slug(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, "");
}

function seedGiocatori(): DemoGiocatore[] {
  const giocatori: DemoGiocatore[] = [];
  for (const categoria of ["M", "F"] as const) {
    NOMI[categoria].forEach((nome, i) => {
      const cognome =
        COGNOMI[(i * 7 + (categoria === "F" ? 3 : 0)) % COGNOMI.length];
      giocatori.push({
        id: `demo-${categoria.toLowerCase()}-${String(i + 1).padStart(2, "0")}`,
        nome,
        cognome,
        email: `${slug(nome)}.${slug(cognome)}@example.it`,
        categoria,
      });
    });
  }
  giocatori.push({
    id: "demo-senza-categoria",
    nome: "Niccolò",
    cognome: "Senzacategoria",
    email: "niccolo.senzacategoria@example.it",
    categoria: null,
  });
  return giocatori;
}

type Store = {
  giocatori: DemoGiocatore[];
  iscrizioni: Map<string, DemoIscrizione[]>;
};

const STORE_KEY = Symbol.for("blvs.demo.iscrittiAdmin");

function store(): Store {
  const g = globalThis as unknown as Record<symbol, Store | undefined>;
  return (g[STORE_KEY] ??= {
    giocatori: seedGiocatori(),
    iscrizioni: new Map(),
  });
}

const ATTIVI: readonly StatoIscrizione[] = ["in_attesa", "confermata"];

function toRow(i: DemoIscrizione): IscrittoRow {
  return {
    id: i.id,
    posto: i.posto,
    stato: i.stato,
    created_at: i.created_at,
    categoria: i.categoria,
    nome: i.nome,
    cognome: i.cognome,
    email: i.email,
  };
}

function attiva(i: DemoIscrizione) {
  return ATTIVI.includes(i.stato);
}

/** The stage's registrations, generated from its board counts once. */
function iscrizioniDi(tappaId: string): DemoIscrizione[] | null {
  const tappa = getDemoTappaGestione(tappaId);
  if (!tappa) return null;
  const s = store();
  const esistenti = s.iscrizioni.get(tappaId);
  if (esistenti) return esistenti;

  const base = new Date(
    tappa.row.iscrizioni_aprono_il ?? "2027-05-15T07:00:00Z",
  ).getTime();
  const generate: DemoIscrizione[] = [];
  for (const board of tappa.tabelloni) {
    const giocatori = s.giocatori.filter(
      (g) => g.categoria === board.categoria,
    );
    const stati: StatoIscrizione[] = [
      ...Array<StatoIscrizione>(board.confermate).fill("confermata"),
      ...Array<StatoIscrizione>(board.inAttesa).fill("in_attesa"),
    ];
    stati.slice(0, giocatori.length).forEach((stato, i) => {
      const g = giocatori[i];
      generate.push({
        id: `${tappaId}--${g.id}`,
        utenteId: g.id,
        posto: i + 1,
        stato,
        created_at: new Date(base + i * 97 * 60 * 1000).toISOString(),
        categoria: board.categoria,
        nome: g.nome,
        cognome: g.cognome,
        email: g.email,
      });
    });
  }
  s.iscrizioni.set(tappaId, generate);
  return generate;
}

function postiDi(tappaId: string): number {
  return getDemoTappaGestione(tappaId)?.posti ?? POSTI_PREDEFINITI;
}

function scriviConti(tappaId: string, categoria: Categoria) {
  const attive = (iscrizioniDi(tappaId) ?? []).filter(
    (i) => i.categoria === categoria && attiva(i),
  );
  aggiornaContiDemo(tappaId, categoria, {
    confermate: attive.filter((i) => i.stato === "confermata").length,
    inAttesa: attive.filter((i) => i.stato === "in_attesa").length,
  });
}

export type DemoIscritti = {
  tappa: TappaIscrittiRow;
  tabelloni: TabelloneIscrittiRow[];
  rows: IscrittoRow[];
};

export function demoIscrittiTappa(tappaId: string): DemoIscritti | null {
  const tappa = getDemoTappaGestione(tappaId);
  const iscrizioni = iscrizioniDi(tappaId);
  if (!tappa || !iscrizioni) return null;
  const posti = postiDi(tappaId);
  return {
    tappa: {
      id: tappa.row.id,
      nome: tappa.row.nome,
      data_inizio: tappa.row.data_inizio,
      data_fine: tappa.row.data_fine,
      stato: tappa.row.stato,
    },
    tabelloni: tappa.tabelloni.map((t) => ({ categoria: t.categoria, posti })),
    rows: iscrizioni.filter(attiva).map(toRow),
  };
}

/** Same match as the real search: every word in name, surname or email. */
export function cercaDemoGiocatori(
  tappaId: string,
  parole: readonly string[],
  limit: number,
): GiocatoreTrovato[] {
  const iscrizioni = iscrizioniDi(tappaId) ?? [];
  const cerca = parole.map((p) => p.toLocaleLowerCase("it"));
  return store()
    .giocatori.filter((g) =>
      cerca.every((q) =>
        [g.nome, g.cognome, g.email].some((v) =>
          v.toLocaleLowerCase("it").includes(q),
        ),
      ),
    )
    .sort(
      (a, b) =>
        a.cognome.localeCompare(b.cognome, "it") ||
        a.nome.localeCompare(b.nome, "it"),
    )
    .slice(0, limit)
    .map((g) => ({
      id: g.id,
      nome: g.nome,
      cognome: g.cognome,
      email: g.email,
      categoria: g.categoria,
      iscritto: iscrizioni.some((i) => i.utenteId === g.id && attiva(i)),
    }));
}

export type DemoEsitoIscritti =
  | { ok: true; row: IscrittoRow }
  | {
      ok: false;
      motivo:
        | "tappaNonTrovata"
        | "giocatoreNonTrovato"
        | "iscrizioneNonTrovata"
        | "categoriaMancante"
        | "giaIscritto"
        | "postiEsauriti"
        | "annullata"
        | "archiviata"
        | "nonModificabile";
    };

function statoBloccato(tappaId: string): DemoEsitoIscritti | null {
  const stato = getDemoTappaGestione(tappaId)?.row.stato;
  if (!stato) return { ok: false, motivo: "tappaNonTrovata" };
  if (stato === "annullata") return { ok: false, motivo: "annullata" };
  if (stato === "archiviata") return { ok: false, motivo: "archiviata" };
  if (!iscrittiModificabili(stato))
    return { ok: false, motivo: "nonModificabile" };
  return null;
}

/** `admin_iscrivi_giocatore()` on the demo data: lowest free seat. */
export function aggiungiDemoIscritto(
  tappaId: string,
  utenteId: string,
  at: Date,
): DemoEsitoIscritti {
  const bloccato = statoBloccato(tappaId);
  if (bloccato) return bloccato;
  const iscrizioni = iscrizioniDi(tappaId)!;
  const g = store().giocatori.find((x) => x.id === utenteId);
  if (!g) return { ok: false, motivo: "giocatoreNonTrovato" };
  if (!g.categoria) return { ok: false, motivo: "categoriaMancante" };
  if (iscrizioni.some((i) => i.utenteId === utenteId && attiva(i)))
    return { ok: false, motivo: "giaIscritto" };

  const posti = postiDi(tappaId);
  const occupati = new Set(
    iscrizioni
      .filter((i) => i.categoria === g.categoria && attiva(i))
      .map((i) => i.posto),
  );
  if (occupati.size >= posti) return { ok: false, motivo: "postiEsauriti" };
  let posto = 1;
  while (occupati.has(posto)) posto += 1;

  // A withdrawn registration of the same player is replaced.
  const altre = iscrizioni.filter((i) => i.utenteId !== utenteId);
  const nuova: DemoIscrizione = {
    id: `${tappaId}--${utenteId}--${at.getTime()}`,
    utenteId,
    posto,
    stato: "confermata",
    created_at: at.toISOString(),
    categoria: g.categoria,
    nome: g.nome,
    cognome: g.cognome,
    email: g.email,
  };
  store().iscrizioni.set(tappaId, [...altre, nuova]);
  scriviConti(tappaId, g.categoria);
  return { ok: true, row: toRow(nuova) };
}

/** `admin_rimuovi_iscrizione()` on the demo data: the seat is freed. */
export function rimuoviDemoIscritto(
  tappaId: string,
  iscrizioneId: string,
): DemoEsitoIscritti {
  const bloccato = statoBloccato(tappaId);
  if (bloccato) return bloccato;
  const iscrizione = iscrizioniDi(tappaId)!.find(
    (i) => i.id === iscrizioneId && attiva(i),
  );
  if (!iscrizione) return { ok: false, motivo: "iscrizioneNonTrovata" };
  iscrizione.stato = "ritirata";
  scriviConti(tappaId, iscrizione.categoria);
  return { ok: true, row: toRow(iscrizione) };
}
