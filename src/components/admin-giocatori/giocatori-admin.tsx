import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/responsive-table/responsive-table";
import { buttonVariants } from "@/components/ui/button";
import {
  filtriHref,
  paroleFiltro,
  type FiltriGiocatori as Filtri,
} from "@/lib/giocatori/admin/filtri";
import { giocatoreAdminPath } from "@/lib/giocatori/admin/paths";
import type {
  ElencoGiocatori,
  GiocatoreAdmin,
} from "@/lib/giocatori/admin/types";
import { FiltriGiocatori } from "./filtri-giocatori";
import { CategoriaGiocatore, StatoVerifica } from "./parti";

const COLONNE: readonly ResponsiveTableColumn<GiocatoreAdmin>[] = [
  {
    key: "nome",
    header: "Giocatore",
    rowHeader: true,
    width: "30%",
    render: (g) => (
      <Link
        href={giocatoreAdminPath(g.id)}
        className="font-semibold underline underline-offset-4 focus-ring"
      >
        {`${g.cognome} ${g.nome}`.trim() || "Senza nome"}
      </Link>
    ),
  },
  {
    key: "email",
    header: "Email",
    width: "34%",
    render: (g) => (
      <span className="font-mono text-sm break-all">{g.email || "–"}</span>
    ),
  },
  {
    key: "categoria",
    header: "Categoria",
    width: "16%",
    render: (g) => <CategoriaGiocatore categoria={g.categoria} />,
  },
  {
    key: "verifica",
    header: "Verifica",
    width: "20%",
    render: (g) => (
      <StatoVerifica daVerificare={g.daVerificare} ruolo={g.ruolo} />
    ),
  },
];

/** «12 giocatori», «1 giocatore da verificare». */
export function riepilogoElenco(totale: number, filtri: Filtri): string {
  const giocatori = `${totale} ${totale === 1 ? "giocatore" : "giocatori"}`;
  const verifica = filtri.daVerificare ? " da verificare" : "";
  const ricerca = paroleFiltro(filtri).length > 0 ? ` per «${filtri.q}»` : "";
  return `${giocatori}${verifica}${ricerca}`;
}

/**
 * w-admin-giocatori: the accounts with search and the «da verificare»
 * filter; each name opens w-admin-giocatore.
 */
export function GiocatoriAdmin({
  elenco,
  filtri,
}: {
  elenco: ElencoGiocatori;
  filtri: Filtri;
}) {
  const corta = filtri.q !== "" && paroleFiltro(filtri).length === 0;
  return (
    <div className="flex flex-col gap-stack" data-testid="giocatori-admin">
      <FiltriGiocatori filtri={filtri} />
      <p role="status" className="font-semibold" data-testid="giocatori-totale">
        {riepilogoElenco(elenco.totale, filtri)}
        {corta ? " (ricerca troppo corta: elenco completo)" : ""}
      </p>
      <ResponsiveTable
        caption="Giocatori"
        captionHidden
        columns={COLONNE}
        rows={elenco.giocatori}
        getRowKey={(g) => g.id}
        rowAttributes={(g) => ({
          "data-giocatore": g.id,
          "data-da-verificare": String(g.daVerificare),
        })}
        emptyMessage={
          filtri.daVerificare
            ? "Nessun giocatore con la categoria da verificare."
            : "Nessun giocatore trovato."
        }
      />
      {elenco.pagine > 1 ? (
        <nav
          aria-label="Pagine dei giocatori"
          className="flex flex-wrap items-center gap-space-3"
        >
          {elenco.pagina > 1 ? (
            <Link
              href={filtriHref({ ...filtri, pagina: elenco.pagina - 1 })}
              className={buttonVariants({ variant: "secondary" })}
            >
              <ChevronLeftIcon aria-hidden className="size-4" />
              Pagina precedente
            </Link>
          ) : null}
          <p className="font-mono tabular-nums">
            Pagina {elenco.pagina} di {elenco.pagine}
          </p>
          {elenco.pagina < elenco.pagine ? (
            <Link
              href={filtriHref({ ...filtri, pagina: elenco.pagina + 1 })}
              className={buttonVariants({ variant: "secondary" })}
            >
              Pagina successiva
              <ChevronRightIcon aria-hidden className="size-4" />
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
