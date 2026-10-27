"use client";

import { cn } from "cn";
import { MinusIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { mergeIds } from "@/lib/utils";
import {
  etichettaAggiungi,
  etichettaTogli,
  nomiCompleti,
} from "@/lib/punteggi/format";
import type { GiocatorePartita } from "@/lib/punteggi/types";
import {
  ETICHETTA_ESITO,
  PUNTI_MASSIMI,
  SIMBOLO_ESITO,
  type EsitoCampo,
} from "@/lib/punteggi/validazione";

type RigaSquadraProps = {
  id: string;
  name: string;
  coppia: string;
  giocatori: readonly GiocatorePartita[];
  value: string;
  onChange: (value: string) => void;
  esito: EsitoCampo;
  /** This field's own problem (empty, not a number). */
  error?: string;
  /** Problem of the whole score (tie, set rule), shown once below. */
  punteggioInvalido: boolean;
  punteggioErroreId: string;
  esitoId: string;
  disabled?: boolean;
};

/** Next value of a stepper: an empty or invalid field counts as 0. */
export function passo(value: string, delta: 1 | -1): string {
  const n = /^\d+$/.test(value.trim()) ? Number(value.trim()) : 0;
  return String(Math.min(PUNTI_MASSIMI, Math.max(0, n + delta)));
}

/**
 * One team's row: the pair, a numeric field with 56px −/+ steppers and
 * the outcome (✓ ! ·) written next to the field.
 */
export function RigaSquadra({
  id,
  name,
  coppia,
  giocatori,
  value,
  onChange,
  esito,
  error,
  punteggioInvalido,
  punteggioErroreId,
  esitoId,
  disabled = false,
}: RigaSquadraProps) {
  const invalido = error != null || punteggioInvalido;
  return (
    <div
      data-slot="riga-squadra"
      data-esito={esito}
      className="flex flex-col gap-space-2 border-s-8 border-primary bg-background p-inset"
    >
      <Field
        id={id}
        size="campo"
        label={<span className="font-heading text-xl">{coppia}</span>}
        hint={nomiCompleti(giocatori)}
        error={error}
        disabled={disabled}
      >
        <div className="flex flex-wrap items-center gap-space-2">
          <Button
            type="button"
            variant="secondary"
            size="icon-campo-lg"
            aria-label={etichettaTogli(coppia)}
            disabled={disabled}
            onClick={() => onChange(passo(value, -1))}
          >
            <MinusIcon aria-hidden />
          </Button>
          <Input
            name={name}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            enterKeyHint="next"
            maxLength={3}
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
            aria-invalid={invalido || undefined}
            aria-describedby={mergeIds(
              esitoId,
              punteggioInvalido ? punteggioErroreId : undefined,
            )}
            className="h-14 w-24 text-center font-mono text-3xl font-bold tabular-nums"
          />
          <Button
            type="button"
            variant="secondary"
            size="icon-campo-lg"
            aria-label={etichettaAggiungi(coppia)}
            disabled={disabled}
            onClick={() => onChange(passo(value, 1))}
          >
            <PlusIcon aria-hidden />
          </Button>
          <span
            id={esitoId}
            data-slot="esito"
            className={cn(
              "inline-flex min-w-12 items-center gap-space-1 font-mono text-lg font-bold",
              esito === "errore" && "text-error-fg",
            )}
          >
            <span aria-hidden="true">{SIMBOLO_ESITO[esito]}</span>
            <span className="text-sm font-semibold">
              {ETICHETTA_ESITO[esito]}
            </span>
          </span>
        </div>
      </Field>
    </div>
  );
}
