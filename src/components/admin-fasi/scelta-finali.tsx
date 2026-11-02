"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { Categoria } from "@/lib/db/types";
import type { FinaleDaComporre } from "@/lib/gironi/fasi/qualificazione";
import { uominiDonne } from "@/lib/tappe/formato";

/** The picks per final: registration ids. */
export type SceltaFinaliStato = Partial<
  Record<FinaleDaComporre["fase"], readonly string[]>
>;

const CATEGORIA_TITOLO: Record<Categoria, string> = {
  M: "Uomini",
  F: "Donne",
};

/** Men and women picked in `finale`. */
export function contaScelti(
  finale: FinaleDaComporre,
  scelta: SceltaFinaliStato,
): Record<Categoria, number> {
  const ids = new Set(scelta[finale.fase] ?? []);
  const conta = { M: 0, F: 0 };
  for (const c of finale.candidati) {
    if (ids.has(c.iscrizioneId)) conta[c.categoria] += 1;
  }
  return conta;
}

/** Every final has exactly its men and women. */
export function sceltaCompleta(
  finali: readonly FinaleDaComporre[],
  scelta: SceltaFinaliStato,
): boolean {
  return finali.every((f) => {
    const conta = contaScelti(f, scelta);
    return conta.M === f.perCategoria && conta.F === f.perCategoria;
  });
}

/**
 * The mixed finals composed by hand: for each final, the players of its
 * colour split into men and women, with where they come from and their
 * group record. A category is full once its places are taken: its other
 * boxes are disabled until one is unticked.
 */
export function SceltaFinali({
  finali,
  scelta,
  onChange,
  disabled = false,
}: {
  finali: readonly FinaleDaComporre[];
  scelta: SceltaFinaliStato;
  onChange: (scelta: SceltaFinaliStato) => void;
  disabled?: boolean;
}) {
  function cambia(
    finale: FinaleDaComporre,
    iscrizioneId: string,
    scelto: boolean,
  ) {
    const attuali = scelta[finale.fase] ?? [];
    onChange({
      ...scelta,
      [finale.fase]: scelto
        ? [...attuali, iscrizioneId]
        : attuali.filter((id) => id !== iscrizioneId),
    });
  }

  return (
    <div className="flex flex-col gap-stack" data-testid="scelta-finali">
      {finali.map((finale) => {
        const conta = contaScelti(finale, scelta);
        const scelti = new Set(scelta[finale.fase] ?? []);
        return (
          <fieldset
            key={finale.fase}
            className="m-0 flex min-w-0 flex-col gap-space-3 border-2 border-primary p-inset"
            data-fase={finale.fase}
          >
            <legend className="px-space-1 font-heading text-lg font-semibold">
              {finale.nome}
            </legend>
            <p role="status" className="text-sm">
              Scegli {uominiDonne(finale.perCategoria, finale.perCategoria)}.
              Scelti: {uominiDonne(conta.M, conta.F)}.
            </p>
            <div className="grid gap-stack md:grid-cols-2">
              {(["M", "F"] as const).map((categoria) => {
                const pieno = conta[categoria] >= finale.perCategoria;
                return (
                  <fieldset
                    key={categoria}
                    className="m-0 flex min-w-0 flex-col gap-space-2 p-0"
                  >
                    <legend className="mb-space-1 p-0 font-semibold">
                      {CATEGORIA_TITOLO[categoria]}
                    </legend>
                    {finale.candidati
                      .filter((c) => c.categoria === categoria)
                      .map((c) => {
                        const selezionato = scelti.has(c.iscrizioneId);
                        return (
                          <Checkbox
                            key={c.iscrizioneId}
                            label={c.nome}
                            description={`${c.provenienza} · ${c.dettaglio}`}
                            checked={selezionato}
                            disabled={disabled || (pieno && !selezionato)}
                            onCheckedChange={(valore) =>
                              cambia(finale, c.iscrizioneId, valore === true)
                            }
                          />
                        );
                      })}
                  </fieldset>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
