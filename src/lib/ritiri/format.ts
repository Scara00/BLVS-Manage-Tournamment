import { esitoScelta } from "@/lib/punteggi/correzione/format";
import type { SceltaImpatto } from "@/lib/punteggi/correzione/types";
import { REGOLA_RITIRO, type RegolaRitiro } from "./regola";
import type {
  AssenzaRegistrata,
  MotivoErroreRitiro,
  TipoRitiro,
} from "./types";

export const RITIRO_MESSAGES = {
  giocatoreMancante: "Scegli il giocatore.",
  tipoMancante: "Scegli se è un ritiro o un'assenza.",
  partiteMancanti: "Scegli almeno una partita.",
  partitaNonValida:
    "Una partita scelta non è di questo giocatore o è già annullata: ricarica la pagina.",
  giaRegistrata:
    "Per una partita scelta il ritiro o l'assenza è già registrato: ricarica la pagina.",
  conflict:
    "Nel frattempo un punteggio delle partite scelte è cambiato: controlla l'anteprima e conferma di nuovo.",
  nonRegistrabile:
    "Ritiri e assenze si registrano solo mentre la tappa è in corso.",
  permissionDenied:
    "Solo l'organizzazione può registrare un ritiro o un'assenza.",
  sessionExpired: "La sessione è scaduta: accedi di nuovo per registrare.",
  network:
    "Non è stato possibile registrare. Controlla la connessione e riprova.",
  offline: "Sei offline: ritiri e assenze si registrano solo con la rete.",
} as const satisfies Partial<Record<string, string>> &
  Record<MotivoErroreRitiro, string>;

/** «Ritirato», or «Assente in 2 partite»: shown as text in the standing. */
export function notaAssenze(
  assenze: readonly Pick<AssenzaRegistrata, "tipo">[],
): string | null {
  if (assenze.length === 0) return null;
  if (assenze.some((a) => a.tipo === "ritiro")) return "Ritirato";
  return assenze.length === 1
    ? "Assente in 1 partita"
    : `Assente in ${assenze.length} partite`;
}

/** The note of every player with an absence, by registration id. */
export function noteAssenze(
  assenze: readonly AssenzaRegistrata[],
): Map<string, string> {
  const perGiocatore = new Map<string, AssenzaRegistrata[]>();
  for (const a of assenze) {
    perGiocatore.set(a.iscrizioneId, [
      ...(perGiocatore.get(a.iscrizioneId) ?? []),
      a,
    ]);
  }
  const note = new Map<string, string>();
  for (const [id, delGiocatore] of perGiocatore) {
    const nota = notaAssenze(delGiocatore);
    if (nota) note.set(id, nota);
  }
  return note;
}

function partite(n: number) {
  return n === 1 ? "1 partita" : `${n} partite`;
}

/** What the rule did, e.g. «2 partite annullate». */
export function effettoRegola(n: number, regola: RegolaRitiro = REGOLA_RITIRO) {
  return regola.esito === "annulla"
    ? `${partite(n)} ${n === 1 ? "annullata" : "annullate"}`
    : `${partite(n)} ${n === 1 ? "persa" : "perse"} ${regola.puntiPerdente}–${regola.puntiVincitore} a tavolino`;
}

/** The confirmation button: «Registra il ritiro (2 partite)». */
export function etichettaRegistra(tipo: TipoRitiro | null, n: number) {
  const cosa =
    tipo === "ritiro"
      ? "il ritiro"
      : tipo === "assenza"
        ? "l'assenza"
        : "ritiro o assenza";
  return n > 0 ? `Registra ${cosa} (${partite(n)})` : `Registra ${cosa}`;
}

/** The message after a save, focused on the page. */
export function esitoRitiro({
  tipo,
  nome,
  n,
  scelta,
  punteggiPersi,
  regola = REGOLA_RITIRO,
}: {
  tipo: TipoRitiro;
  nome: string;
  n: number;
  scelta: SceltaImpatto | null;
  punteggiPersi: number;
  regola?: RegolaRitiro;
}) {
  const fatto = tipo === "ritiro" ? "Ritiro registrato" : "Assenza registrata";
  return [
    `${fatto} per ${nome}: ${effettoRegola(n, regola)}. La classifica del girone è ricalcolata e l'operazione è nel registro.`,
    esitoScelta(scelta, punteggiPersi),
  ]
    .filter(Boolean)
    .join(" ");
}

/** The texts of w-admin-impatto-fase when a withdrawal triggers it. */
export function testiImpattoRitiro(tipo: TipoRitiro | null) {
  const cosa = tipo === "assenza" ? "l'assenza" : "il ritiro";
  return {
    scelta: `Scegli se mantenerla com'è o rigenerarla dalla classifica dopo ${cosa}.`,
    mantieni: `La fase successiva resta com'è, con i suoi punteggi. Il registro annota che è stata mantenuta dopo ${cosa}.`,
    rigenera: `I gironi e le partite della fase successiva vengono eliminati: la proponi di nuovo dalla classifica ricalcolata.`,
  };
}
