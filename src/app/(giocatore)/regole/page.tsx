import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { spiegaRegolaClassifica } from "@/lib/gironi/classifica/criteri";
import { REGOLA_QUALIFICAZIONE } from "@/lib/gironi/fasi/regole";

export const metadata: Metadata = { title: "Regole" };

function posti(posizioni: readonly number[]): string {
  const testo = posizioni.map((p) => `${p}°`);
  return testo.length > 1
    ? `${testo.slice(0, -1).join(", ")} e ${testo.at(-1)}`
    : (testo[0] ?? "");
}

/**
 * w-regole, minimal (BLVS-47): how a group standing is ordered and who
 * goes to gold or silver. Every sentence comes from the rule modules, so
 * the page follows the rules in code. BLVS-46 can grow it; keep the
 * `#spareggi` anchor, w-girone links to it.
 */
export default function RegolePage() {
  return (
    <PageContainer
      title="Regole"
      eyebrow="Circuito"
      description="Come si ordina la classifica di un girone e chi va avanti."
    >
      <section
        id="spareggi"
        aria-labelledby="regole-spareggi-titolo"
        className="flex max-w-3xl scroll-mt-space-6 flex-col gap-space-3"
      >
        <h2
          id="regole-spareggi-titolo"
          className="font-heading text-xl font-semibold"
        >
          Classifica del girone e spareggi
        </h2>
        <p>
          In ogni partita i punti della squadra contano per entrambi i
          giocatori. La classifica segue questi criteri, uno dopo l’altro, solo
          tra chi è ancora pari:
        </p>
        <ol className="flex list-decimal flex-col gap-space-2 ps-space-6">
          {spiegaRegolaClassifica().map((frase) => (
            <li key={frase}>{frase}</li>
          ))}
        </ol>
      </section>
      <section
        id="gold-silver"
        aria-labelledby="regole-gold-silver-titolo"
        className="flex max-w-3xl scroll-mt-space-6 flex-col gap-space-3"
      >
        <h2
          id="regole-gold-silver-titolo"
          className="font-heading text-xl font-semibold"
        >
          Gold e silver
        </h2>
        <p>
          Dopo i gironi iniziali, i {posti(REGOLA_QUALIFICAZIONE.gold)}{" "}
          classificati di ogni girone giocano i gironi «★ Gold», i{" "}
          {posti(REGOLA_QUALIFICAZIONE.silver)} i gironi «◆ Silver». Nella
          pagina del girone la linea di taglio separa le due fasce.
        </p>
      </section>
    </PageContainer>
  );
}
