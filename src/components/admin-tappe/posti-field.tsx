"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { CategoriaTabellone } from "@/lib/db/types";
import { POSTI_MISTO_MULTIPLO, TABELLONE_NOME } from "@/lib/tappe/formato";
import { gironiCompleti, regolaGironi } from "@/lib/tappe/gironi";
import { CAMPO_POSTI, POSTI_MAX, POSTI_MIN } from "@/lib/tappe/nuova/types";
import { AvvisoGironi } from "./avviso-gironi";

/**
 * A maximum the groups warning applies to (out-of-range, or a mixed one
 * that is not a multiple of 8, is an error).
 */
function daAvvisare(raw: string, categoria: CategoriaTabellone): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const posti = Number(raw);
  if (posti < POSTI_MIN || posti > POSTI_MAX) return null;
  if (categoria === "X" && posti % POSTI_MISTO_MULTIPLO !== 0) return null;
  return gironiCompleti(posti, regolaGironi(categoria)) ? null : posti;
}

type PostiFieldProps = {
  categoria: CategoriaTabellone;
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
  const [avviso, setAvviso] = useState(() =>
    daAvvisare(String(defaultValue), categoria),
  );

  // A restored draft writes the input directly: check its value again.
  useEffect(() => {
    if (restoredAt && inputRef.current) {
      setAvviso(daAvvisare(inputRef.current.value, categoria));
    }
  }, [restoredAt, categoria]);

  function usa(posti: number) {
    const input = inputRef.current;
    if (!input) return;
    input.value = String(posti);
    // Lets the local draft see the new value.
    input.dispatchEvent(new Event("input", { bubbles: true }));
    setAvviso(daAvvisare(input.value, categoria));
    input.focus();
  }

  return (
    <Field
      label={
        categoria === "X"
          ? "Massimo giocatori · tabellone misto"
          : `Massimo iscritti · tabellone ${TABELLONE_NOME[categoria]}`
      }
      hint={
        categoria === "X"
          ? `Multiplo di ${POSTI_MISTO_MULTIPLO} tra ${POSTI_MISTO_MULTIPLO} e ${POSTI_MAX}: metà posti agli uomini, metà alle donne (es. 32 = 16 + 16), per gironi da 4 uomini e 4 donne.`
          : `Tra ${POSTI_MIN} e ${POSTI_MAX}. Vale solo per il tabellone ${TABELLONE_NOME[categoria]}.`
      }
      required
      error={error}
      className="max-w-md"
    >
      <Input
        ref={inputRef}
        name={CAMPO_POSTI[categoria]}
        type="number"
        inputMode="numeric"
        min={categoria === "X" ? POSTI_MISTO_MULTIPLO : POSTI_MIN}
        max={POSTI_MAX}
        step={categoria === "X" ? POSTI_MISTO_MULTIPLO : 1}
        defaultValue={defaultValue}
        className="max-w-40 font-mono"
        aria-describedby={avviso !== null ? avvisoId : undefined}
        onBlur={(event) =>
          setAvviso(daAvvisare(event.currentTarget.value, categoria))
        }
      />
      <AvvisoGironi
        id={avvisoId}
        categoria={categoria}
        regola={regolaGironi(categoria)}
        posti={avviso}
        onUsa={usa}
      />
    </Field>
  );
}
