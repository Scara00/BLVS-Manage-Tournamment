import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/responsive-table/responsive-table";
import {
  CLASSIFICA_CATEGORIA,
  righePerCategoria,
  titoloMisto,
} from "@/lib/tappe/formato";
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
  {
    key: "nome",
    header: "Giocatore",
    rowHeader: true,
    render: (r) => {
      const titolo = titoloMisto({
        category: r.categoria,
        phase: r.fase,
        position: r.posizione,
      });
      return (
        <span className="inline-flex flex-wrap items-center gap-space-2">
          {r.nome}
          {titolo ? (
            <span className="bg-tape px-space-2 font-heading text-xs font-semibold tracking-wider text-primary uppercase">
              {titolo}
            </span>
          ) : null}
        </span>
      );
    },
  },
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
 * The mixed board's stage standing: places only, it gives no points to the
 * overall standing. Men and women are ranked apart: one table per final
 * and category, the gold final's 1st man and woman are King and Queen.
 */
function ClassificaMista({ righe }: { righe: readonly RigaClassificaTappa[] }) {
  return (
    <section
      aria-labelledby="punti-tappa-titolo"
      className="flex min-w-0 flex-col gap-stack-sm [overflow-wrap:anywhere]"
      data-testid="punti-tappa"
    >
      <h2
        id="punti-tappa-titolo"
        className="font-heading text-xl font-semibold"
      >
        Classifica della tappa
      </h2>
      <p className="text-sm">
        Il misto non assegna punti alla classifica generale.
      </p>
      {righe.length === 0 ? (
        <p>La classifica si compone con le finali gold e silver.</p>
      ) : (
        (["gold", "silver", null] as const).flatMap((fase) =>
          righePerCategoria(
            righe
              .filter((r) => r.fase === fase)
              .map((r) => ({ ...r, category: r.categoria })),
          )
            .filter((g) => g.rows.length > 0)
            .map(({ categoria, rows }) => {
              const finale = fase
                ? `Finale ${FASE_LABEL[fase].toLowerCase()}`
                : "Finale";
              const titolo = categoria
                ? `${finale} · ${CLASSIFICA_CATEGORIA[categoria]}`
                : finale;
              return (
                <div
                  key={`${fase ?? "altra"}-${categoria ?? "tutti"}`}
                  className="flex flex-col gap-space-2"
                >
                  <h3 className="font-heading text-lg font-semibold">
                    {titolo}
                  </h3>
                  <ResponsiveTable
                    caption={titolo}
                    captionHidden
                    columns={columns.filter((c) => c.key !== "punti")}
                    rows={rows}
                    getRowKey={(r) => r.iscrizioneId}
                    emptyMessage="Nessun giocatore nelle finali."
                  />
                </div>
              );
            }),
        )
      )}
    </section>
  );
}

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
  if (classifica?.senzaPunti) return <ClassificaMista righe={righe} />;
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
