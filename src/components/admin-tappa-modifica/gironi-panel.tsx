"use client";

import { CheckCircle2Icon } from "lucide-react";
import { useId } from "react";
import { AvvisoGironi } from "@/components/admin-tappe";
import { Tape } from "@/components/scoreboard";
import type { Categoria } from "@/lib/db/types";
import { REGOLA_GIRONI, gironiCompleti } from "@/lib/tappe/gironi";
import { POSTI_MAX, POSTI_MIN } from "@/lib/tappe/nuova/types";

const TABELLONE = { M: "maschile", F: "femminile" } as const;

/** A maximum the groups warning applies to (out-of-range is an error). */
export function postiDaAvvisare(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const posti = Number(raw);
  if (posti < POSTI_MIN || posti > POSTI_MAX) return null;
  return gironiCompleti(posti) ? null : posti;
}

type GironiPanelProps = {
  /** The maximums as typed in the form, per board. */
  posti: Record<Categoria, string>;
  /** Active registrations per board: «Usa N» never proposes less. */
  iscritti: Record<Categoria, number>;
  /** «Usa N»: puts N into that board's maximum. */
  onUsa: (categoria: Categoria, posti: number) => void;
};

/**
 * Incomplete-groups warning of «Nuova tappa» (BLVS-19), as a panel for
 * both boards. It sits before the form in the DOM, so on phones it comes
 * first; from `lg` it moves into a side column.
 */
export function GironiPanel({ posti, iscritti, onUsa }: GironiPanelProps) {
  const base = useId();
  const avvisi = {
    M: postiDaAvvisare(posti.M),
    F: postiDaAvvisare(posti.F),
  };
  const tuttiCompleti = avvisi.M === null && avvisi.F === null;

  return (
    <section
      aria-labelledby={`${base}-titolo`}
      data-slot="gironi-panel"
      className="flex flex-col gap-space-3 border-2 border-neutral-200 p-inset md:p-inset-lg"
    >
      <div className="flex flex-col gap-space-2">
        <h2
          id={`${base}-titolo`}
          className="font-heading text-lg font-semibold"
        >
          Gironi
        </h2>
        <Tape size={4} className="max-w-16" />
      </div>
      {tuttiCompleti ? (
        <p className="flex items-start gap-space-2 text-success-fg">
          <CheckCircle2Icon aria-hidden className="mt-1 size-4 shrink-0" />
          Con questi massimi i gironi sono completi in tutte le fasi.
        </p>
      ) : null}
      {(["M", "F"] as const).map((categoria) => (
        <AvvisoGironi
          key={categoria}
          id={`${base}-${categoria}`}
          categoria={categoria}
          posti={avvisi[categoria]}
          onUsa={(proposta) => onUsa(categoria, proposta)}
          regola={{
            ...REGOLA_GIRONI,
            proposte: REGOLA_GIRONI.proposte.filter(
              (proposta) => proposta >= iscritti[categoria],
            ),
          }}
        />
      ))}
      <p className="text-sm text-muted-foreground">
        Tabellone {TABELLONE.M}:{" "}
        <span className="font-mono">{posti.M || "—"}</span> · tabellone{" "}
        {TABELLONE.F}: <span className="font-mono">{posti.F || "—"}</span>
      </p>
    </section>
  );
}
