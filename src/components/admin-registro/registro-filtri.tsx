"use client";

import { FilterIcon } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { filtriAttivi, OPZIONI_TIPO } from "@/lib/registro/filtri";
import { registroPath } from "@/lib/registro/paths";
import type { FiltriRegistro, PartitaFiltro } from "@/lib/registro/types";

/**
 * Filters by event type and match. A GET form: the filters live in the
 * URL (`?tipo=…&partita=…`), so the server reads the first page again and
 * a filtered view can be shared or reloaded.
 */
export function RegistroFiltri({
  tappaId,
  filtri,
  partite,
}: {
  tappaId: string;
  filtri: FiltriRegistro;
  partite: readonly PartitaFiltro[];
}) {
  return (
    <Form
      action={registroPath(tappaId)}
      aria-label="Filtra il registro"
      className="flex flex-col gap-space-4 border-2 border-neutral-200 p-inset md:flex-row md:flex-wrap md:items-end"
    >
      <Field label="Tipo" className="md:w-64">
        <Select name="tipo" defaultValue={filtri.tipo ?? ""}>
          <option value="">Tutti i tipi</option>
          {OPZIONI_TIPO.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Partita" className="min-w-0 md:flex-1">
        <Select name="partita" defaultValue={filtri.partita ?? ""}>
          <option value="">Tutte le partite</option>
          {partite.map((p) => (
            <option key={p.id} value={p.id}>
              {p.etichetta}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex flex-wrap gap-space-3">
        <Button type="submit" className="max-w-full">
          <FilterIcon aria-hidden className="size-4" />
          Applica i filtri
        </Button>
        {filtriAttivi(filtri) ? (
          <Link
            href={registroPath(tappaId)}
            className={buttonVariants({
              variant: "secondary",
              className: "max-w-full",
            })}
          >
            Azzera i filtri
          </Link>
        ) : null}
      </div>
    </Form>
  );
}
