import { describe, expect, it } from "vitest";
import { correzione } from "@/components/admin-punteggio/stories-data";
import { validaPunteggio } from "../validazione";
import {
  annuncioCosaCambia,
  classificaCon,
  cosaCambia,
  NESSUN_CAMBIO,
  RICALCOLO,
} from "./cosa-cambia";

const { partita, girone } = correzione;

function cambio(a: string, b: string) {
  return cosaCambia(partita, girone!, validaPunteggio({ a, b }));
}

const testi = (c: ReturnType<typeof cambio>) => c.voci.map((v) => v.testo);

describe("cosaCambia (BLVS-41)", () => {
  it("lo stesso punteggio non cambia nulla", () => {
    expect(cambio("21", "18")).toMatchObject({
      valido: true,
      invariato: true,
      voci: [{ testo: NESSUN_CAMBIO }],
    });
  });

  it("«non chiude il set» è scritto come errore, senza classifica", () => {
    const c = cambio("21", "20");
    expect(c.valido).toBe(false);
    expect(c.voci).toHaveLength(1);
    expect(c.voci[0]).toMatchObject({ errore: true });
    expect(c.voci[0].testo).toMatch(/^21–20 non chiude il set: A 21 servono/);
    expect(annuncioCosaCambia(c)).toContain("non chiude il set");
  });

  it("anche il pareggio non chiude il set", () => {
    expect(cambio("21", "21").voci[0].testo).toBe(
      "21–21 non chiude il set: il pareggio non è ammesso.",
    );
  });

  it("valori incompleti: chiede entrambi i punti", () => {
    const c = cambio("21", "");
    expect(c.valido).toBe(false);
    expect(c.voci[0].errore).toBeUndefined();
  });

  it("stesso vincitore: cambiano solo i punti e la classifica può restare", () => {
    const c = cambio("21", "16");
    expect(testi(c)).toContain("Vince ancora Rinaldi/Moretti.");
    expect(testi(c)).toContain("Conti/Gallo: 18 → 16 punti.");
    expect(testi(c)).not.toContain("Rinaldi/Moretti: 21 → 21 punti.");
    expect(testi(c).at(-1)).toBe(RICALCOLO);
  });

  it("vincitore ribaltato: la classifica del girone si ricalcola", () => {
    const c = cambio("10", "21");
    expect(testi(c)).toContain(
      "Il vincitore cambia: ora vince Conti/Gallo, non più Rinaldi/Moretti.",
    );
    const prima = classificaCon(partita, girone!, partita.sets);
    const dopo = classificaCon(partita, girone!, [{ a: 10, b: 21 }]);
    const rinaldiPrima = prima.righe.find((r) => r.iscrizioneId === "i1")!;
    const rinaldiDopo = dopo.righe.find((r) => r.iscrizioneId === "i1")!;
    expect(rinaldiDopo.vinte).toBe(rinaldiPrima.vinte - 1);
    // Gallo goes from 4th to 2nd on point difference.
    expect(testi(c)).toContain("Gallo Andrea: dal 4° al 2° posto in Girone A.");
    // Every player whose place changes is listed in words.
    const spostati = dopo.righe.filter(
      (r) =>
        prima.righe.find((p) => p.iscrizioneId === r.iscrizioneId)!
          .posizione !== r.posizione,
    );
    expect(spostati.length).toBeGreaterThan(0);
    for (const r of spostati) {
      expect(c.voci.some((v) => v.id === `posto-${r.iscrizioneId}`)).toBe(true);
    }
  });
});
