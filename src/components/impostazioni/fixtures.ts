import type { OverallPlayerRow } from "@/lib/live/types";
import type { Impostazioni, RigaPubblica } from "@/lib/impostazioni/types";

const luca: OverallPlayerRow = {
  playerId: "demo-u-m-01",
  name: "Luca Rossi",
  position: 3,
  points: 28,
  stages: 3,
  provisional: true,
  tied: false,
};

export const rigaLuca: RigaPubblica = {
  categoria: "M",
  stagione: 2026,
  attuale: luca,
};

/** Stories and tests: «Luca Rossi», 3rd with 28 provisional points. */
export const impostazioniLuca: Impostazioni = {
  nome: "Luca",
  cognome: "Rossi",
  email: "luca.rossi@blvs.test",
  consenso: {
    versione: "1.0",
    dataInformativa: "2026-10-27",
    accettatoIl: "2026-10-27T16:42:00.000Z",
  },
  riga: rigaLuca,
};

const lungo: OverallPlayerRow = {
  ...luca,
  name: "Maria Antonietta Costanza Filomena Dell'Acqua Bianchi Lombardi",
  position: 12,
  points: 4,
  tied: true,
};

/** Long names and a shared place, for 390px and 200% text. */
export const impostazioniTestoLungo: Impostazioni = {
  nome: "Maria Antonietta Costanza Filomena",
  cognome: "Dell'Acqua Bianchi Lombardi",
  email:
    "maria.antonietta.costanza.filomena.dellacqua-bianchi@associazione-sportiva-dilettantistica.example.it",
  consenso: { ...impostazioniLuca.consenso!, dataInformativa: null },
  riga: {
    categoria: "F",
    stagione: 2026,
    attuale: lungo,
  },
};
