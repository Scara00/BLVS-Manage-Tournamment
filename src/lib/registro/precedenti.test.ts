import { describe, expect, it } from "vitest";
import {
  paginaPrecedente,
  registroStorie,
} from "@/components/admin-registro/stories-data";
import { VOCI_PER_PAGINA } from "./messages";
import {
  annuncioPrecedenti,
  cursorePrecedenti,
  etichettaPrecedenti,
  unisciPagina,
} from "./precedenti";

describe("voci precedenti", () => {
  it("il cursore è la voce più vecchia, finché ne restano", () => {
    const { pagina } = registroStorie({ restanti: 5 });
    expect(pagina.restanti).toBe(5);
    expect(cursorePrecedenti(pagina)).toBe(pagina.voci.at(-1)?.id);
    expect(cursorePrecedenti({ ...pagina, restanti: 0 })).toBeNull();
    expect(cursorePrecedenti({ voci: [], restanti: 3 })).toBeNull();
  });

  it("accoda la pagina precedente senza doppioni", () => {
    const { pagina } = registroStorie({ restanti: 5 });
    const precedente = paginaPrecedente(5);
    const unita = unisciPagina(pagina, precedente);
    expect(unita.voci).toHaveLength(pagina.voci.length + 5);
    expect(unita.restanti).toBe(0);
    // A second click on the same page adds nothing.
    expect(unisciPagina(unita, precedente).voci).toHaveLength(
      unita.voci.length,
    );
  });

  it("dice quante voci carica il prossimo clic", () => {
    expect(etichettaPrecedenti(12)).toBe("Mostra le 12 voci precedenti");
    expect(etichettaPrecedenti(1)).toBe("Mostra la voce precedente");
    expect(etichettaPrecedenti(VOCI_PER_PAGINA + 40)).toBe(
      `Mostra le ${VOCI_PER_PAGINA} voci precedenti`,
    );
    expect(annuncioPrecedenti(1, 4)).toBe("Caricata 1 voce precedente.");
    expect(annuncioPrecedenti(5, 0)).toBe(
      "Caricate 5 voci precedenti. Non ci sono altre voci.",
    );
  });
});
