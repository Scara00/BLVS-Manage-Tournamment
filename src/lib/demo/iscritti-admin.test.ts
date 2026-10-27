import { describe, expect, it } from "vitest";
import { creaDemoTappa, getDemoTappaGestione } from "./gestione-tappe";
import {
  aggiungiDemoIscritto,
  cercaDemoGiocatori,
  demoIscrittiTappa,
  rimuoviDemoIscritto,
} from "./iscritti-admin";

const AT = new Date("2027-06-01T10:00:00Z");

function tappa(
  posti = 6,
  stato: "iscrizioni_chiuse" | "in_corso" = "iscrizioni_chiuse",
) {
  return creaDemoTappa({ stato, chiudonoIl: null, posti });
}

function liberoM(id: string) {
  return cercaDemoGiocatori(id, ["example"], 100).find(
    (g) => g.categoria === "M" && !g.iscritto,
  )!;
}

describe("iscritti demo (stesse regole di admin_iscrivi_giocatore)", () => {
  it("genera gli iscritti dai conteggi del tabellone, con posti da 1", () => {
    const id = tappa();
    const demo = demoIscrittiTappa(id)!;
    const m = demo.rows.filter((r) => r.categoria === "M");
    expect(m.map((r) => r.posto)).toEqual([1, 2, 3, 4, 5]);
    expect(demo.tabelloni).toEqual([
      { categoria: "M", posti: 6 },
      { categoria: "F", posti: 6 },
    ]);
  });

  it("aggiunge al primo posto libero e rifiuta oltre il massimo", () => {
    const id = tappa(6);
    const primo = aggiungiDemoIscritto(id, liberoM(id).id, AT);
    expect(primo).toMatchObject({
      ok: true,
      row: { posto: 6, stato: "confermata" },
    });
    expect(aggiungiDemoIscritto(id, liberoM(id).id, AT)).toEqual({
      ok: false,
      motivo: "postiEsauriti",
    });
    expect(getDemoTappaGestione(id)!.tabelloni[0]).toMatchObject({
      confermate: 5,
      inAttesa: 1,
    });
  });

  it("rifiuta un duplicato e chi non ha categoria", () => {
    const id = tappa(16);
    const giocatore = liberoM(id).id;
    aggiungiDemoIscritto(id, giocatore, AT);
    expect(aggiungiDemoIscritto(id, giocatore, AT)).toEqual({
      ok: false,
      motivo: "giaIscritto",
    });
    expect(aggiungiDemoIscritto(id, "demo-senza-categoria", AT)).toEqual({
      ok: false,
      motivo: "categoriaMancante",
    });
  });

  it("la rimozione libera il posto, che va al prossimo aggiunto", () => {
    const id = tappa(5);
    const secondo = demoIscrittiTappa(id)!.rows.find(
      (r) => r.categoria === "M" && r.posto === 2,
    )!;
    expect(rimuoviDemoIscritto(id, secondo.id)).toMatchObject({
      ok: true,
      row: { stato: "ritirata", posto: 2 },
    });
    expect(rimuoviDemoIscritto(id, secondo.id)).toEqual({
      ok: false,
      motivo: "iscrizioneNonTrovata",
    });
    expect(aggiungiDemoIscritto(id, liberoM(id).id, AT)).toMatchObject({
      ok: true,
      row: { posto: 2 },
    });
  });

  it("una tappa in corso è in sola lettura", () => {
    const id = tappa(16, "in_corso");
    expect(aggiungiDemoIscritto(id, liberoM(id).id, AT)).toEqual({
      ok: false,
      motivo: "nonModificabile",
    });
  });

  it("la ricerca vuole ogni parola e segna chi è già iscritto", () => {
    const id = tappa();
    const iscritto = demoIscrittiTappa(id)!.rows[0];
    const trovati = cercaDemoGiocatori(
      id,
      [iscritto.nome.toUpperCase(), iscritto.cognome.slice(0, 3)],
      20,
    );
    expect(trovati).toContainEqual(
      expect.objectContaining({ email: iscritto.email, iscritto: true }),
    );
  });
});
