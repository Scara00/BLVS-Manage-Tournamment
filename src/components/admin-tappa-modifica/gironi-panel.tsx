"use client";

import { CheckCircle2Icon } from "lucide-react";
import { useId } from "react";
import { AvvisoGironi } from "@/components/admin-tappe";
import { Tape } from "@/components/scoreboard";
import type { CategoriaTabellone } from "@/lib/db/types";
import { TABELLONE_NOME } from "@/lib/tappe/formato";
import { REGOLA_GIRONI, gironiCompleti } from "@/lib/tappe/gironi";
import { POSTI_MAX, POSTI_MIN } from "@/lib/tappe/nuova/types";

/** A maximum the groups warning applies to (out-of-range is an error). */
export function postiDaAvvisare(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const posti = Number(raw);
  if (posti < POSTI_MIN || posti > POSTI_MAX) return null;
  return gironiCompleti(posti) ? null : posti;
}

type GironiPanelProps = {
  /** The boards of the stage: M and F, or the mixed one. */
  categorie?: readonly CategoriaTabellone[];
  /** The maximums as typed in the form, per board. */
  posti: Partial<Record<CategoriaTabellone, string>>;
  /** Active registrations per board: «Usa N» never proposes less. */
  iscritti: Partial<Record<CategoriaTabellone, number>>;
  /** «Usa N»: puts N into that board's maximum. */
  onUsa: (categoria: CategoriaTabellone, posti: number) => void;
};

/**
 * Incomplete-groups warning of «Nuova tappa» (BLVS-19), as a panel for
 * both boards. It sits before the form in the DOM, so on phones it comes
 * first; from `lg` it moves into a side column.
 */
export function GironiPanel({
  categorie = ["M", "F"],
  posti,
  iscritti,
  onUsa,
}: GironiPanelProps) {
  const base = useId();
  const avvisi = Object.fromEntries(
    categorie.map((c) => [c, postiDaAvvisare(posti[c] ?? "")]),
  ) as Partial<Record<CategoriaTabellone, number | null>>;
  const tuttiCompleti = categorie.every((c) => avvisi[c] === null);

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
      {categorie.map((categoria) => (
        <AvvisoGironi
          key={categoria}
          id={`${base}-${categoria}`}
          categoria={categoria}
          posti={avvisi[categoria] ?? null}
          onUsa={(proposta) => onUsa(categoria, proposta)}
          regola={{
            ...REGOLA_GIRONI,
            proposte: REGOLA_GIRONI.proposte.filter(
              (proposta) => proposta >= (iscritti[categoria] ?? 0),
            ),
          }}
        />
      ))}
      <p className="text-sm text-muted-foreground">
        {categorie.map((categoria, i) => (
          <span key={categoria}>
            {i > 0 ? " · " : null}
            {i === 0 ? "Tabellone" : "tabellone"} {TABELLONE_NOME[categoria]}:{" "}
            <span className="font-mono">{posti[categoria] || "—"}</span>
          </span>
        ))}
      </p>
    </section>
  );
}
