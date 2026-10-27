import type { TipoEventoRegistro, ValoreRegistro } from "@/lib/audit";
import { NESSUN_FILTRO } from "@/lib/registro/filtri";
import { toPagina, toPartiteFiltro } from "@/lib/registro/format";
import type {
  FiltriRegistro,
  PartitaFiltroDb,
  PaginaRegistro,
  RegistroTappaView,
  VoceRegistroDb,
} from "@/lib/registro/types";

/** Stories and tests: «oggi» is Saturday 12 June 2027 (Rome). */
export const OGGI = "2027-06-12";

export const PARTITE_STORIE: PartitaFiltroDb[] = [
  {
    partita_id: "0d1f0c4e-5a0b-4c1e-9a10-000000000001",
    partita: {
      categoria: "M",
      fase: "gironi",
      girone: "Girone A",
      turno: 1,
      squadra_a: ["Luca Rossi", "Marco Bianchi"],
      squadra_b: ["Andrea Ferrari", "Matteo Russo"],
    },
  },
  {
    partita_id: "0d1f0c4e-5a0b-4c1e-9a10-000000000002",
    partita: {
      categoria: "F",
      fase: "gironi",
      girone: "Girone B",
      turno: 2,
      squadra_a: ["Giulia Conti", "Sara Marino"],
      squadra_b: ["Chiara Greco", "Francesca Gallo"],
    },
  },
];

const [M, F] = PARTITE_STORIE;

type Riga = [
  string,
  TipoEventoRegistro,
  PartitaFiltroDb | null,
  ValoreRegistro | null,
  ValoreRegistro | null,
  string | null,
];

const set = (a: number, b: number) => ({ sets: [{ a, b }] });

/** Newest first; UTC instants (Rome is UTC+2 in June). */
const RIGHE: Riga[] = [
  [
    "2027-06-12T09:42:10Z",
    "correzione_punteggio",
    M,
    set(21, 18),
    set(21, 19),
    "Errore di battitura",
  ],
  ["2027-06-12T09:31:00Z", "inserimento_punteggio", F, null, set(19, 21), null],
  ["2027-06-12T09:12:45Z", "inserimento_punteggio", M, null, set(21, 18), null],
  [
    "2027-06-12T08:05:00Z",
    "parita_risolta",
    null,
    null,
    { girone: "Girone A", ordine: ["Luca Rossi", "Marco Bianchi"] },
    "Sorteggio in campo",
  ],
  [
    "2027-06-11T16:20:00Z",
    "annullamento_punteggio",
    F,
    set(21, 15),
    null,
    "Partita da rigiocare",
  ],
  [
    "2027-06-11T15:02:00Z",
    "ritiro",
    null,
    null,
    null,
    "Infortunio alla caviglia",
  ],
  [
    "2027-06-11T10:00:00Z",
    "rigenerazione_gironi",
    null,
    { gironi: [{ nome: "Girone A" }, { nome: "Girone B" }], punteggi_persi: 2 },
    { categoria: "M", gironi: 3, partite: 9, punteggi_persi: 2 },
    "Rigenerazione con 2 punteggi persi",
  ],
  [
    "2027-06-09T08:30:00Z",
    "cambio_categoria",
    null,
    { categoria: "M" },
    { categoria: "F" },
    "Categoria corretta su richiesta",
  ],
];

export function righeStorie(n = RIGHE.length, restanti = 0): VoceRegistroDb[] {
  const scelte = RIGHE.slice(0, n);
  return scelte.map(([quando, tipo, partita, prima, dopo, nota], i) => ({
    id: 1000 - i,
    tipo,
    created_at: quando,
    autore: i % 2 === 0 ? "Paola Arbitri" : "Giorgio Tavoli",
    partita_id: partita?.partita_id ?? null,
    partita: partita?.partita ?? null,
    valore_prima: prima,
    valore_dopo: dopo,
    nota,
    totale: scelte.length + restanti,
  }));
}

/** Older entries for «Mostra le N voci precedenti». */
export function paginaPrecedente(n: number, primoId = 900): PaginaRegistro {
  const rows: VoceRegistroDb[] = Array.from({ length: n }, (_, i) => ({
    id: primoId - i,
    tipo: "inserimento_punteggio",
    created_at: `2027-06-08T${String(17 - (i % 9)).padStart(2, "0")}:00:00Z`,
    autore: "Paola Arbitri",
    partita_id: M.partita_id,
    partita: M.partita,
    valore_prima: null,
    valore_dopo: set(21, 10 + (i % 9)),
    nota: null,
    totale: n,
  }));
  return toPagina(rows);
}

export function registroStorie({
  voci = RIGHE.length,
  restanti = 0,
  filtri = NESSUN_FILTRO,
}: {
  voci?: number;
  restanti?: number;
  filtri?: FiltriRegistro;
} = {}): RegistroTappaView {
  return {
    tappa: { id: "jesolo", nome: "Tappa 1 · Jesolo" },
    oggi: OGGI,
    filtri,
    partite: toPartiteFiltro(PARTITE_STORIE),
    pagina: toPagina(righeStorie(voci, restanti)),
    lettoAlle: "11:45",
  };
}
