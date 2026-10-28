import { describe, expect, it } from "vitest";
import type {
  ClassificaTappa,
  RigaClassificaTappa,
} from "@/lib/tappe/classifica/classifica";
import { descriviCambio, riepilogoCambi } from "./format";
import { firmaPunti, puntiCheCambiano, puntiDefinitivi } from "./punti";

function riga(
  iscrizioneId: string,
  posizione: number,
  punti: number | null,
): RigaClassificaTappa {
  return {
    iscrizioneId,
    nome: `Giocatore ${iscrizioneId}`,
    fase: "gold",
    posizione,
    posizioneFase: posizione,
    posizioneDefinitiva: true,
    punti,
    puntiProvvisori: false,
    ritirato: false,
    daRisolvere: false,
  };
}

const classifica = (righe: RigaClassificaTappa[]): ClassificaTappa => ({
  righe,
  stato: "conclusa",
  puntiProvvisori: false,
});

describe("punti che cambiano", () => {
  const prima = classifica([
    riga("a", 1, 12),
    riga("b", 2, 8),
    riga("c", 3, 4),
  ]);

  it("elenca solo chi cambia posto o punti, nell'ordine nuovo", () => {
    const dopo = classifica([
      riga("b", 1, 12),
      riga("a", 2, 8),
      riga("c", 3, 4),
    ]);
    const cambi = puntiCheCambiano(prima, dopo);
    expect(cambi.map((c) => c.iscrizioneId)).toEqual(["b", "a"]);
    expect(descriviCambio(cambi[0])).toBe(
      "Giocatore b: 2° con 8 punti → 1° con 12 punti",
    );
    expect(riepilogoCambi(cambi)).toBe("Cambiano i punti di 2 giocatori.");
  });

  it("nessun cambio, nessuna voce", () => {
    expect(puntiCheCambiano(prima, prima)).toEqual([]);
    expect(riepilogoCambi([])).toBe("Nessun punto della tappa cambia.");
  });

  it("la firma cambia con i punti, l'istantanea li riporta", () => {
    const dopo = classifica([
      riga("a", 1, 12),
      riga("b", 2, 6),
      riga("c", 3, 4),
    ]);
    expect(firmaPunti(prima)).not.toBe(firmaPunti(dopo));
    expect(puntiDefinitivi(prima)).toEqual([
      { iscrizioneId: "a", nome: "Giocatore a", posizione: 1, punti: 12 },
      { iscrizioneId: "b", nome: "Giocatore b", posizione: 2, punti: 8 },
      { iscrizioneId: "c", nome: "Giocatore c", posizione: 3, punti: 4 },
    ]);
  });
});
