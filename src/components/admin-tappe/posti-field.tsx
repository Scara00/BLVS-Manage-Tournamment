"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Categoria } from "@/lib/db/types";
import { gironiCompleti } from "@/lib/tappe/gironi";
import { CAMPO_POSTI, POSTI_MAX, POSTI_MIN } from "@/lib/tappe/nuova/types";
import { AvvisoGironi } from "./avviso-gironi";

const TABELLONE = { M: "maschile", F: "femminile" } as const;

/** A maximum the groups warning applies to (out-of-range is an error). */
function daAvvisare(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const posti = Number(raw);
  if (posti < POSTI_MIN || posti > POSTI_MAX) return null;
  return gironiCompleti(posti) ? null : posti;
}

type PostiFieldProps = {
  categoria: Categoria;
  defaultValue: number;
  error?: string;
  /** Changes when a local draft was put back into the form. */
  restoredAt?: string | null;
};

/**
 * Maximum registrations of one board. The groups check runs when the value
 * is committed (blur, «Usa N»), not on every keystroke, so the warning
 * appears once instead of flickering while the admin types.
 */
export function PostiField({
  categoria,
  defaultValue,
  error,
  restoredAt,
}: PostiFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const avvisoId = useId();
  const [avviso, setAvviso] = useState(() => daAvvisare(String(defaultValue)));

  // A restored draft writes the input directly: check its value again.
  useEffect(() => {
    if (restoredAt && inputRef.current) {
      setAvviso(daAvvisare(inputRef.current.value));
    }
  }, [restoredAt]);

  function usa(posti: number) {
    const input = inputRef.current;
    if (!input) return;
    input.value = String(posti);
    // Lets the local draft see the new value.
    input.dispatchEvent(new Event("input", { bubbles: true }));
    setAvviso(daAvvisare(input.value));
    input.focus();
  }

  return (
    <Field
      label={`Massimo iscritti · tabellone ${TABELLONE[categoria]}`}
      hint={`Tra ${POSTI_MIN} e ${POSTI_MAX}. Vale solo per il tabellone ${TABELLONE[categoria]}.`}
      required
      error={error}
      className="max-w-md"
    >
      <Input
        ref={inputRef}
        name={CAMPO_POSTI[categoria]}
        type="number"
        inputMode="numeric"
        min={POSTI_MIN}
        max={POSTI_MAX}
        step={1}
        defaultValue={defaultValue}
        className="max-w-40 font-mono"
        aria-describedby={avviso !== null ? avvisoId : undefined}
        onBlur={(event) => setAvviso(daAvvisare(event.currentTarget.value))}
      />
      <AvvisoGironi
        id={avvisoId}
        categoria={categoria}
        posti={avviso}
        onUsa={usa}
      />
    </Field>
  );
}
