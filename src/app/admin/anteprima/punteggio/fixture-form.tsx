"use client";

import { useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import {
  CodaPunteggiPanel,
  StatoPunteggioPartita,
  useCodaPunteggi,
} from "@/components/coda-punteggi";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const PATH = "/admin/anteprima/punteggio";

/** `?partita=<id>&versione=<n>`: the demo match created by the e2e. */
export function PunteggioFixtureForm() {
  const params = useSearchParams();
  const partitaId = params?.get("partita") ?? "";
  const versione = Number(params?.get("versione") ?? "1") || 1;
  const coda = useCodaPunteggi();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void coda.accoda({
      partitaId,
      versione,
      sets: [{ a: Number(data.get("a")), b: Number(data.get("b")) }],
      etichetta: "Partita di prova",
      path: `${PATH}?partita=${partitaId}&versione=${versione}`,
    });
  }

  return (
    <div className="flex flex-col gap-stack">
      <form className="flex max-w-md flex-col gap-stack" onSubmit={onSubmit}>
        <Field label="Punti squadra A">
          <Input
            name="a"
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            required
          />
        </Field>
        <Field label="Punti squadra B">
          <Input
            name="b"
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            required
          />
        </Field>
        <div className="flex flex-wrap items-center gap-space-3">
          <Button type="submit" size="campo" className="max-w-full">
            Salva punteggio
          </Button>
          <StatoPunteggioPartita partitaId={partitaId} />
        </div>
      </form>
      <CodaPunteggiPanel />
    </div>
  );
}
