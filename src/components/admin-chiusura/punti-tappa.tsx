import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/responsive-table/responsive-table";
import { Badge } from "@/components/ui/badge";
import type {
  ClassificaTappa,
  RigaClassificaTappa,
} from "@/lib/tappe/classifica/classifica";

const FASE_LABEL = { gold: "Gold", silver: "Silver" } as const;

const columns: ResponsiveTableColumn<RigaClassificaTappa>[] = [
  {
    key: "posizione",
    header: "Posizione",
    numeric: true,
    width: "15%",
    render: (r) => (
      <span className="font-mono font-semibold tabular-nums">
        {r.posizione}°
      </span>
    ),
  },
  { key: "nome", header: "Giocatore", rowHeader: true },
  {
    key: "fase",
    header: "Finale",
    render: (r) => (r.fase ? FASE_LABEL[r.fase] : "—"),
  },
  {
    key: "punti",
    header: "Punti",
    numeric: true,
    render: (r) => (
      <span className="flex flex-col items-end gap-space-1">
        <span className="font-mono text-lg font-semibold tabular-nums">
          {r.punti ?? "—"}
        </span>
        {r.daRisolvere ? (
          <span className="text-sm font-semibold">Parità da risolvere</span>
        ) : null}
      </span>
    ),
  },
];

/**
 * «Punti della tappa» on w-admin-live (BLVS-40 standing): «Provvisori» on
 * tape until the board is concluded, then «Definitivi» (BLVS-43). The
 * state is always text, never colour alone.
 */
export function PuntiTappa({
  classifica,
}: {
  classifica: ClassificaTappa | null;
}) {
  const righe = classifica?.righe ?? [];
  const provvisori = classifica?.puntiProvvisori ?? true;
  return (
    <section
      aria-labelledby="punti-tappa-titolo"
      className="flex min-w-0 flex-col gap-stack-sm [overflow-wrap:anywhere]"
      data-testid="punti-tappa"
    >
      <div className="flex flex-wrap items-center gap-space-3">
        <h2
          id="punti-tappa-titolo"
          className="font-heading text-xl font-semibold"
        >
          Punti della tappa
        </h2>
        {righe.length > 0 ? (
          provvisori ? (
            <Badge variant="tape" data-testid="punti-stato">
              Provvisori
            </Badge>
          ) : (
            <Badge
              variant="neutral"
              className="border-2 border-primary text-primary"
              data-testid="punti-stato"
            >
              Definitivi
            </Badge>
          )
        ) : null}
      </div>
      {righe.length === 0 ? (
        <p>I punti si assegnano con le finali gold e silver.</p>
      ) : (
        <>
          <p className="text-sm">
            {provvisori
              ? "I punti diventano definitivi quando il tabellone è concluso."
              : "Il tabellone è concluso: questi punti sono definitivi."}
          </p>
          <ResponsiveTable
            caption="Punti della tappa"
            captionHidden
            columns={columns}
            rows={righe}
            getRowKey={(r) => r.iscrizioneId}
            emptyMessage="Nessun giocatore nelle finali."
          />
        </>
      )}
    </section>
  );
}
