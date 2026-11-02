import type {
  Categoria,
  CategoriaTabellone,
  StatoIscrizione,
  StatoTappa,
} from "@/lib/db/types";

/** An active registration as read from the database (or the demo store). */
export type IscrittoRow = {
  id: string;
  posto: number | null;
  stato: StatoIscrizione;
  created_at: string;
  /** The board of the registration. */
  categoria: CategoriaTabellone;
  /** The player's own category (M/F), shown on a mixed board. */
  categoriaGiocatore?: Categoria | null;
  nome: string;
  cognome: string;
  email: string;
};

/** A board of the stage: its maximum. */
export type TabelloneIscrittiRow = {
  categoria: CategoriaTabellone;
  posti: number;
};

export type TappaIscrittiRow = {
  id: string;
  nome: string;
  data_inizio: string;
  data_fine: string;
  stato: StatoTappa;
};

export type IscrittoView = {
  id: string;
  posto: number | null;
  /** «Cognome Nome». */
  nome: string;
  email: string;
  /** ISO instant of the registration. */
  iscrittoIl: string;
  /** «12/05/2027 14:30», Europe/Rome, shown in mono. */
  iscrittoIlTesto: string;
  stato: StatoIscrizione;
  statoLabel: string;
  /** Mixed board only: «Uomo» / «Donna». */
  categoriaLabel: string | null;
};

/** One half of a mixed board: its seats and players. */
export type QuotaIscrittiView = {
  categoria: Categoria;
  /** «Uomini» / «Donne». */
  label: string;
  posti: number;
  occupati: number;
  liberiTesto: string;
  pieno: boolean;
};

export type IscrittiTabelloneView = {
  categoria: CategoriaTabellone;
  /** «Maschile» / «Femminile» / «Misto». */
  label: string;
  /** Mixed board: the two halves (men, women); empty otherwise. */
  quote: QuotaIscrittiView[];
  posti: number;
  occupati: number;
  liberi: number;
  /** «5 POSTI LIBERI», «1 POSTO LIBERO», «NESSUN POSTO LIBERO». */
  liberiTesto: string;
  pieno: boolean;
  iscritti: IscrittoView[];
};

export type IscrittiTappaView = {
  id: string;
  nome: string;
  periodo: string;
  stato: StatoTappa;
  /** Players can be added and removed only in these states. */
  modificabile: boolean;
  /** Why the list is read-only, when it is. */
  notaSolaLettura: string | null;
  tabelloni: IscrittiTabelloneView[];
};

/** A registered player found by the search of w-admin-aggiungi-giocatore. */
export type GiocatoreTrovato = {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  categoria: Categoria | null;
  /** Already has an active registration to this stage. */
  iscritto: boolean;
};

export type CercaGiocatoriEsito =
  | { status: "ok"; giocatori: GiocatoreTrovato[] }
  | { status: "error"; message: string };

export type CercaGiocatoriAction = (
  tappaId: string,
  query: string,
) => Promise<CercaGiocatoriEsito>;

export type MotivoErroreIscritti =
  "invalid" | "sessionExpired" | "permissionDenied" | "network";

export type ModificaIscrittiState =
  | { status: "idle" }
  | { status: "success"; message: string; at: number }
  | {
      status: "error";
      reason: MotivoErroreIscritti;
      message: string;
      at: number;
    };

export const initialModificaIscrittiState: ModificaIscrittiState = {
  status: "idle",
};

export type ModificaIscrittiAction = (
  prev: ModificaIscrittiState,
  formData: FormData,
) => Promise<ModificaIscrittiState>;
