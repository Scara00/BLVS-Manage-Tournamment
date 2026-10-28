import Link from "next/link";
import { CRITERI, REGOLA_CLASSIFICA } from "@/lib/gironi/classifica/criteri";
import { regoleHref } from "@/lib/regole/paths";

/**
 * The tie-break criteria in short (R-40), in the order they apply, from
 * `REGOLA_CLASSIFICA`; the full sentences are on w-regole (`#spareggi-girone`).
 */
export function CriteriSpareggio() {
  return (
    <section
      aria-labelledby="girone-spareggi-titolo"
      className="flex flex-col gap-space-3"
    >
      <h2
        id="girone-spareggi-titolo"
        className="font-heading text-xl font-semibold"
      >
        Come si decide l’ordine
      </h2>
      <p>
        La classifica guarda, nell’ordine, e passa al criterio dopo solo tra chi
        è ancora pari:
      </p>
      <ol className="list-decimal ps-space-6" data-testid="girone-criteri">
        {REGOLA_CLASSIFICA.criteri.map((id) => (
          <li key={id}>{CRITERI[id].etichetta}</li>
        ))}
      </ol>
      <p>
        Se restano pari decide l’organizzazione.{" "}
        <Link
          href={regoleHref("spareggiGirone")}
          className="font-semibold underline decoration-2 underline-offset-4"
        >
          Regole dei gironi e degli spareggi
        </Link>
      </p>
    </section>
  );
}
