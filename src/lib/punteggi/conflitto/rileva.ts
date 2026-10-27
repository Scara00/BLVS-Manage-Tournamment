/**
 * Conflict between two admins on one match score (BLVS-34, R-57). Pure:
 * shared by the save action, the demo store and the dialog.
 */

/** One set, as stored in `punteggi.sets`: points of team A and team B. */
export type SetConflitto = { a: number; b: number };

/** The score row as saved in the DB (`punteggi`). */
export type PunteggioUfficiale = {
  /** `punteggi.versione`: grows by exactly 1 on every save. */
  versione: number;
  sets: SetConflitto[];
  /** Who saved it, «Nome Cognome»; null when unknown. */
  autore: string | null;
  /** ISO instant of the save; null when unknown. */
  salvatoIl: string | null;
};

/**
 * A save attempt. `versione` is the version the form read. `sovrascrivi`
 * is the version shown in the conflict dialog when the admin confirmed
 * «Sovrascrivi»: the overwrite only applies over THAT value.
 */
export type TentativoSalvataggio = {
  versione: number;
  sovrascrivi?: number | null;
};

/** The version changed after the form read it. */
export function rilevaConflitto(
  versioneLetta: number,
  versioneAttuale: number,
): boolean {
  return versioneLetta !== versioneAttuale;
}

/**
 * Whether a save may write over the current row. Never true for a stale
 * version: an overwrite needs the admin to have seen the current value
 * (`sovrascrivi` = the version shown in the dialog), so a third save in the
 * meantime opens the dialog again instead of being lost silently.
 */
export function puoSalvare(
  tentativo: TentativoSalvataggio,
  versioneAttuale: number,
): boolean {
  const base = tentativo.sovrascrivi ?? tentativo.versione;
  return !rilevaConflitto(base, versioneAttuale);
}

export function stessiSets(x: SetConflitto[], y: SetConflitto[]): boolean {
  return (
    x.length === y.length &&
    x.every((set, i) => set.a === y[i].a && set.b === y[i].b)
  );
}

/** One number of the comparison; `diverso` when the other side differs. */
export type CifraConfronto = { valore: number; diverso: boolean };

export type SetConfronto = {
  /** 1-based set number. */
  numero: number;
  /** null when this side has no such set. */
  salvato: { a: CifraConfronto; b: CifraConfronto } | null;
  mio: { a: CifraConfronto; b: CifraConfronto } | null;
};

function cifra(
  valore: number,
  altro: SetConflitto | undefined,
  lato: "a" | "b",
): CifraConfronto {
  return { valore, diverso: altro === undefined || altro[lato] !== valore };
}

/** Set by set comparison, marking each number that differs. */
export function confrontaPunteggi(
  salvato: SetConflitto[],
  mio: SetConflitto[],
): SetConfronto[] {
  const n = Math.max(salvato.length, mio.length);
  return Array.from({ length: n }, (_, i) => {
    const s = salvato[i];
    const m = mio[i];
    return {
      numero: i + 1,
      salvato: s ? { a: cifra(s.a, m, "a"), b: cifra(s.b, m, "b") } : null,
      mio: m ? { a: cifra(m.a, s, "a"), b: cifra(m.b, s, "b") } : null,
    };
  });
}

/** «21-18 · 19-21», or «nessun punteggio». */
export function formatSets(sets: SetConflitto[]): string {
  if (sets.length === 0) return "nessun punteggio";
  return sets.map((s) => `${s.a}-${s.b}`).join(" · ");
}

/** Read aloud: «set 1: 21 a 18; set 2: 19 a 21», or «nessun punteggio». */
export function leggiSets(sets: SetConflitto[]): string {
  if (sets.length === 0) return "nessun punteggio";
  return sets.map((s, i) => `set ${i + 1}: ${s.a} a ${s.b}`).join("; ");
}

export type NomiCoppie = { a: string; b: string };

/**
 * The differences in words, one per number: «Set 1, Rossi/Bianchi: salvato
 * 18, tuo 19». A set only one side has reads «Set 3: salvato 15-13, tuo
 * nessuno».
 */
export function descriviDifferenze(
  confronto: SetConfronto[],
  coppie: NomiCoppie,
): string[] {
  const righe: string[] = [];
  for (const set of confronto) {
    const { salvato, mio } = set;
    if (!salvato || !mio) {
      const s = salvato ? `${salvato.a.valore}-${salvato.b.valore}` : "nessuno";
      const m = mio ? `${mio.a.valore}-${mio.b.valore}` : "nessuno";
      righe.push(`Set ${set.numero}: salvato ${s}, tuo ${m}`);
      continue;
    }
    for (const lato of ["a", "b"] as const) {
      if (!salvato[lato].diverso) continue;
      righe.push(
        `Set ${set.numero}, ${coppie[lato]}: salvato ${salvato[lato].valore}, tuo ${mio[lato].valore}`,
      );
    }
  }
  return righe;
}

/** «alle 14:05», Europe/Rome; empty when unknown. */
export function formatOraSalvataggio(iso: string | null): string {
  if (!iso) return "";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  const ora = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
  return `alle ${ora}`;
}

/** «Un altro admin (Giulia Neri) ha salvato questa partita alle 14:05.» */
export function introConflitto(salvato: PunteggioUfficiale): string {
  const chi = salvato.autore
    ? `Un altro admin (${salvato.autore})`
    : "Un altro admin";
  const quando = formatOraSalvataggio(salvato.salvatoIl);
  return `${chi} ha salvato questa partita${quando ? ` ${quando}` : ""} mentre la modificavi.`;
}
