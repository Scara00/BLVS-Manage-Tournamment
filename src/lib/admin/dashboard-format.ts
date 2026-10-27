export type IscrizioneInAttesa = {
  id: string;
  player: string;
  stage: string;
  received: string;
};

export type AdminDashboard = {
  tappe: number;
  iscrizioniInAttesa: number;
  giocatori: number;
  ultimeIscrizioni: IscrizioneInAttesa[];
};

/** A pending registration joined with its player and stage (PostgREST embeds). */
export type IscrizioneInAttesaRow = {
  id: string;
  created_at: string;
  utente: { nome: string; cognome: string } | null;
  tappa: { nome: string } | null;
};

const receivedFormat = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Rome",
});

export function toIscrizioneInAttesa(
  row: IscrizioneInAttesaRow,
): IscrizioneInAttesa {
  const player = row.utente
    ? `${row.utente.nome} ${row.utente.cognome}`.trim()
    : "";
  return {
    id: row.id,
    player: player || "Giocatore senza nome",
    stage: row.tappa?.nome ?? "—",
    received: receivedFormat.format(new Date(row.created_at)),
  };
}
