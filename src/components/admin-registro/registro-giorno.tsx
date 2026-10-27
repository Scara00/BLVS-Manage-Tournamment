import { useId } from "react";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/responsive-table/responsive-table";
import { Badge } from "@/components/ui/badge";
import { VUOTO } from "@/lib/registro/format";
import type { GiornoRegistro, VoceRegistroView } from "@/lib/registro/types";

function TipoVoce({ voce }: { voce: VoceRegistroView }) {
  // Only the exceptions (Correzione, Parità risolta) are filled badges.
  if (voce.tipo.badge) {
    return (
      <Badge variant="tape" data-testid="badge-eccezione">
        {voce.tipo.label}
      </Badge>
    );
  }
  return <span>{voce.tipo.label}</span>;
}

function PrimaDopo({ voce }: { voce: VoceRegistroView }) {
  return (
    <span className="font-mono [overflow-wrap:anywhere] tabular-nums">
      <span className="sr-only">Prima: </span>
      {voce.prima}
      <span aria-hidden="true"> → </span>
      <span className="sr-only">, dopo: </span>
      {voce.dopo}
    </span>
  );
}

const COLONNE: readonly ResponsiveTableColumn<VoceRegistroView>[] = [
  {
    key: "ora",
    header: "Data e ora",
    rowHeader: true,
    width: "14%",
    render: (voce) => (
      <time dateTime={voce.quando} className="font-mono tabular-nums">
        {voce.dataOra}
      </time>
    ),
  },
  {
    key: "tipo",
    header: "Tipo",
    width: "14%",
    render: (voce) => <TipoVoce voce={voce} />,
  },
  {
    key: "partita",
    header: "Partita",
    width: "26%",
    render: (voce) => voce.partita?.etichetta ?? VUOTO,
  },
  {
    key: "valori",
    header: "Prima → dopo",
    width: "18%",
    render: (voce) => <PrimaDopo voce={voce} />,
  },
  { key: "autore", header: "Autore", width: "12%" },
  {
    key: "nota",
    header: "Nota",
    width: "16%",
    render: (voce) => voce.nota ?? VUOTO,
  },
];

/** One day of the log: heading «Oggi · sabato 12 giugno» and its entries. */
export function RegistroGiorno({ giorno }: { giorno: GiornoRegistro }) {
  const titoloId = useId();
  return (
    <section
      aria-labelledby={titoloId}
      data-testid="registro-giorno"
      data-giorno={giorno.giorno}
      className="flex min-w-0 flex-col gap-space-3"
    >
      <h2
        id={titoloId}
        className="border-b-4 border-tape pb-space-1 font-heading text-xl font-semibold first-letter:uppercase"
      >
        {giorno.etichetta}
      </h2>
      <ResponsiveTable
        caption={`Voci del registro, ${giorno.etichetta}`}
        captionHidden
        columns={COLONNE}
        rows={giorno.voci}
        getRowKey={(voce) => String(voce.id)}
        rowAttributes={(voce) => ({
          "data-voce": String(voce.id),
          "data-tipo": voce.tipo.tipo,
        })}
        stackBelow="lg"
      />
    </section>
  );
}
