import { backoffDelay } from "@/lib/live/client/backoff";
import {
  CODA_MESSAGES as M,
  type EsitoInvio,
  type NuovoPunteggio,
  type StatoVoce,
  type VoceCoda,
} from "./types";

/** How long a saved score stays listed as «Salvato» before it is dropped. */
export const SALVATI_VISIBILI_MS = 10 * 60_000;

/** States that still have to reach the server. */
const DA_INVIARE: readonly StatoVoce[] = [
  "in_attesa",
  "invio",
  "sessione_chiusa",
];

export function inSospeso(voce: VoceCoda): boolean {
  return DA_INVIARE.includes(voce.stato) || voce.stato === "conflitto";
}

/** A new queue entry, with its own key. */
export function nuovaVoce(
  input: NuovoPunteggio,
  {
    autoreId,
    now,
    chiave = crypto.randomUUID(),
  }: { autoreId: string | null; now: Date; chiave?: string },
): VoceCoda {
  const at = now.toISOString();
  return {
    chiave,
    partitaId: input.partitaId,
    versione: input.versione,
    sets: input.sets,
    etichetta: input.etichetta,
    path: input.path,
    autoreId,
    stato: "in_attesa",
    creataIl: at,
    aggiornataIl: at,
    tentativi: 0,
    prossimoTentativo: null,
  };
}

/**
 * Entries of the same match that the new one replaces: a score typed again
 * before the first one left wins locally. A score being sent is not
 * replaced (its answer may already be on the way); the new one queues
 * after it.
 */
export function sostituite(voci: readonly VoceCoda[], nuova: VoceCoda) {
  return voci.filter(
    (v) =>
      v.partitaId === nuova.partitaId &&
      v.chiave !== nuova.chiave &&
      v.stato !== "invio",
  );
}

/**
 * Entries to send now. `forza` (page opened, network back, signed in
 * again) ignores the retry time and resumes the entries a closed session
 * stopped. Only the admin who entered a score sends it.
 */
export function daInviare(
  voci: readonly VoceCoda[],
  {
    autoreId,
    now,
    forza,
  }: { autoreId: string | null; now: Date; forza: boolean },
): VoceCoda[] {
  return voci
    .filter((v) => {
      if (!DA_INVIARE.includes(v.stato)) return false;
      if (v.autoreId && autoreId && v.autoreId !== autoreId) return false;
      if (forza) return true;
      if (v.stato === "sessione_chiusa") return false;
      return (
        v.prossimoTentativo === null ||
        Date.parse(v.prossimoTentativo) <= now.getTime()
      );
    })
    .sort((a, b) => a.creataIl.localeCompare(b.creataIl));
}

/** The entry after one send. */
export function applicaEsito(
  voce: VoceCoda,
  esito: EsitoInvio,
  { now, random = Math.random }: { now: Date; random?: () => number },
): VoceCoda {
  const base = { ...voce, aggiornataIl: now.toISOString() };
  switch (esito.status) {
    case "salvato":
      return {
        ...base,
        stato: "salvato",
        versione: esito.punteggio.versione,
        prossimoTentativo: null,
        server: undefined,
      };
    case "conflitto":
      return {
        ...base,
        stato: "conflitto",
        server: esito.punteggio,
        prossimoTentativo: null,
      };
    case "sessionExpired":
    case "altroAccount":
      return { ...base, stato: "sessione_chiusa", prossimoTentativo: null };
    case "rifiutato":
      return {
        ...base,
        stato: "rifiutato",
        messaggio: esito.message,
        prossimoTentativo: null,
      };
    case "errore":
    case "rete":
      return {
        ...base,
        stato: "in_attesa",
        tentativi: voce.tentativi + 1,
        prossimoTentativo: new Date(
          now.getTime() + backoffDelay(voce.tentativi, random),
        ).toISOString(),
      };
  }
}

/**
 * After the score sent with version `inviata` was saved, a later entry of
 * the same match that the admin typed on top of it now builds on the new
 * version (it is our own save, not someone else's).
 */
export function seguitiDa(
  voci: readonly VoceCoda[],
  salvata: VoceCoda,
  inviata: number,
): VoceCoda[] {
  return voci
    .filter(
      (v) =>
        v.partitaId === salvata.partitaId &&
        v.chiave !== salvata.chiave &&
        DA_INVIARE.includes(v.stato) &&
        v.versione === inviata,
    )
    .map((v) => ({ ...v, versione: salvata.versione }));
}

/**
 * `conflitto` → keep mine: send again over the version shown in the
 * choice, with a new key (if a third save landed meanwhile it is a new
 * conflict, never a blind overwrite).
 */
export function tieniIlMio(voce: VoceCoda, now: Date): VoceCoda | null {
  if (voce.stato !== "conflitto" || !voce.server) return null;
  return {
    ...voce,
    chiave: crypto.randomUUID(),
    versione: voce.server.versione,
    stato: "in_attesa",
    server: undefined,
    tentativi: 0,
    prossimoTentativo: null,
    aggiornataIl: now.toISOString(),
  };
}

/** Saved entries old enough to drop from the list. */
export function scaduti(voci: readonly VoceCoda[], now: Date): VoceCoda[] {
  return voci.filter(
    (v) =>
      v.stato === "salvato" &&
      now.getTime() - Date.parse(v.aggiornataIl) > SALVATI_VISIBILI_MS,
  );
}

/** A page closed mid-send leaves `invio`: it goes back to waiting. */
export function riprendi(voce: VoceCoda): VoceCoda {
  return voce.stato === "invio"
    ? { ...voce, stato: "in_attesa", prossimoTentativo: null }
    : voce;
}

export function etichettaStato(stato: StatoVoce): string {
  return M.stato[stato];
}

/** Newest first per match: the entry that tells the match's state. */
export function ultimaPerPartita(
  voci: readonly VoceCoda[],
  partitaId: string,
): VoceCoda | undefined {
  return voci
    .filter((v) => v.partitaId === partitaId)
    .sort((a, b) => b.aggiornataIl.localeCompare(a.aggiornataIl))[0];
}

/** «2 punteggi in attesa di invio»; `null` when nothing waits. */
export function riassuntoCoda(voci: readonly VoceCoda[]): string | null {
  const attesa = voci.filter(
    (v) => v.stato === "in_attesa" || v.stato === "invio",
  ).length;
  const chiusa = voci.filter((v) => v.stato === "sessione_chiusa").length;
  const conflitti = voci.filter((v) => v.stato === "conflitto").length;
  const parti: string[] = [];
  if (attesa)
    parti.push(
      attesa === 1
        ? "1 punteggio in attesa di invio"
        : `${attesa} punteggi in attesa di invio`,
    );
  if (chiusa)
    parti.push(
      chiusa === 1
        ? "1 punteggio salvato qui, non ancora inviato"
        : `${chiusa} punteggi salvati qui, non ancora inviati`,
    );
  if (conflitti)
    parti.push(
      conflitti === 1
        ? "1 punteggio da verificare"
        : `${conflitti} punteggi da verificare`,
    );
  return parti.length ? parti.join(", ") : null;
}

/**
 * What the status region says when an entry changes state; `null` when
 * the change is not worth announcing (e.g. `in_attesa` → `invio`).
 */
export function annuncioCambio(
  prima: VoceCoda | undefined,
  dopo: VoceCoda,
): string | null {
  if (prima?.stato === dopo.stato) return null;
  if (dopo.stato === "invio") return null;
  if (prima?.stato === "invio" && dopo.stato === "in_attesa") {
    return prima.tentativi === 0
      ? `${dopo.etichetta}: in attesa di invio. Partirà da solo al ritorno della rete.`
      : null;
  }
  switch (dopo.stato) {
    case "in_attesa":
      return `${dopo.etichetta}: in attesa di invio.`;
    case "salvato":
      return `${dopo.etichetta}: salvato.`;
    case "sessione_chiusa":
      return `${dopo.etichetta}: salvato qui, non ancora inviato. Partirà dopo il nuovo accesso.`;
    case "conflitto":
      return `${dopo.etichetta}: un altro admin ha salvato un punteggio diverso. Scegli quale tenere.`;
    case "rifiutato":
      return `${dopo.etichetta}: non inviato. ${dopo.messaggio ?? ""}`.trim();
  }
}
