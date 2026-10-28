import type { EsitoPalette } from "@/lib/admin/palette/types";

/** «jesolo»: one stage, one player and one match (stories and tests). */
export const esitoJesolo: EsitoPalette = {
  status: "ok",
  tappe: [
    {
      tipo: "tappa",
      id: "jesolo",
      titolo: "Tappa 1 · Jesolo",
      dettaglio: "14–15 giugno 2027 · In corso",
      href: "/admin/tappe/jesolo",
    },
  ],
  giocatori: [
    {
      tipo: "giocatore",
      id: "demo-m-01",
      titolo: "Rossi Luca",
      dettaglio: "luca.rossi@example.it · Maschile",
      href: "/classifica/giocatore/demo-m-01?categoria=M",
    },
  ],
  partite: [
    {
      tipo: "partita",
      id: "jesolo-M-g1-t1",
      titolo: "Rossi e Bianchi contro Verdi e Neri",
      dettaglio:
        "Tappa 1 · Jesolo · Maschile · Girone A, turno 1 · Conclusa 21–17",
      href: "/admin/tappe/jesolo/punteggi/jesolo-M-g1-t1",
    },
  ],
};

export const esitoVuoto: EsitoPalette = {
  status: "ok",
  tappe: [],
  giocatori: [],
  partite: [],
};
