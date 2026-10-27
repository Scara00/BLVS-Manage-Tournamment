import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  contaPerStato,
  filtraPerStato,
  type AdminTappa,
  type FiltroStato,
} from "@/lib/admin/tappe";
import { filtroLabel, StatoFilter } from "./stato-filter";
import { TappeTable } from "./tappe-table";

/** BLVS-19's page (`NUOVA_TAPPA_PATH` in `src/lib/tappe/nuova/types.ts`). */
const NUOVA_TAPPA_PATH = "/admin/tappe/nuova";

/**
 * The stage table with its status filter, shared by the dashboard and the
 * «Tappe» admin page. Drafts appear here and nowhere else.
 */
export function AdminTappeSection({
  tappe,
  filtro,
  basePath,
}: {
  tappe: readonly AdminTappa[];
  filtro: FiltroStato;
  basePath: string;
}) {
  const visibili = filtraPerStato(tappe, filtro);
  const filtered = filtro !== "tutte";
  return (
    <section
      aria-labelledby="admin-tappe-titolo"
      data-slot="admin-tappe"
      className="flex flex-col gap-stack"
    >
      <div className="flex flex-wrap items-center justify-between gap-stack-sm">
        <h2
          id="admin-tappe-titolo"
          className="font-heading text-2xl font-semibold tracking-tight"
        >
          Tappe
        </h2>
        <Link href={NUOVA_TAPPA_PATH} className={buttonVariants()}>
          Nuova tappa
        </Link>
      </div>
      <StatoFilter
        basePath={basePath}
        current={filtro}
        counts={contaPerStato(tappe)}
      />
      <p role="status" className="text-muted-foreground">
        {filtered
          ? `${visibili.length} di ${tappe.length} tappe · stato «${filtroLabel(filtro)}»`
          : `${tappe.length} ${tappe.length === 1 ? "tappa" : "tappe"} in calendario`}
      </p>
      <TappeTable
        tappe={visibili}
        caption={
          filtered ? `Tappe · ${filtroLabel(filtro)}` : "Tappe del circuito"
        }
        emptyMessage={
          filtered
            ? `Nessuna tappa nello stato «${filtroLabel(filtro)}».`
            : undefined
        }
      />
    </section>
  );
}
