import type { VoceCoda } from "@/lib/punteggi/coda/types";

/** Queue entries for stories and component tests. */
export function voceDiProva(over: Partial<VoceCoda> = {}): VoceCoda {
  return {
    chiave: "c0000000-0000-4000-8000-000000000001",
    partitaId: "p0000000-0000-4000-8000-000000000001",
    versione: 1,
    sets: [{ a: 21, b: 18 }],
    etichetta: "Girone A · turno 1 · Rossi/Bianchi – Verdi/Neri",
    path: "/admin",
    autoreId: "demo",
    stato: "in_attesa",
    creataIl: "2027-06-12T09:42:00.000Z",
    aggiornataIl: "2027-06-12T09:42:00.000Z",
    tentativi: 0,
    prossimoTentativo: null,
    ...over,
  };
}

export const CODA_MISTA: VoceCoda[] = [
  voceDiProva(),
  voceDiProva({
    chiave: "c0000000-0000-4000-8000-000000000002",
    partitaId: "p0000000-0000-4000-8000-000000000002",
    etichetta: "Girone B · turno 2 · Gallo/Ferri – Conti/Russo",
    sets: [{ a: 19, b: 21 }],
    stato: "salvato",
    versione: 2,
    creataIl: "2027-06-12T09:30:00.000Z",
  }),
  voceDiProva({
    chiave: "c0000000-0000-4000-8000-000000000003",
    partitaId: "p0000000-0000-4000-8000-000000000003",
    etichetta: "Girone C · turno 1 · Costa/Greco – Marino/Rizzi",
    sets: [{ a: 21, b: 23 }],
    stato: "conflitto",
    server: { sets: [{ a: 21, b: 17 }], versione: 2 },
    creataIl: "2027-06-12T09:20:00.000Z",
  }),
];
