import { CheckIcon, LockIcon, MailWarningIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CategoryLabel, Tape } from "@/components/scoreboard";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { IMPOSTAZIONI_PATH } from "@/lib/impostazioni/types";
import {
  PROFILO_MESSAGES,
  PROFILO_MODIFICA_PATH,
  emailInAttesaMessage,
  type Profilo,
} from "@/lib/profilo/types";
import { CATEGORIA_LABEL } from "./categoria";

function Riga({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-space-1 px-inset py-space-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-space-4 md:px-inset-lg">
      <dt className="font-heading text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="flex min-w-0 flex-col items-start gap-space-2 text-lg [overflow-wrap:anywhere]">
        {children}
      </dd>
    </div>
  );
}

/** w-profilo: the player's personal data, read only, with text badges. */
export function ProfiloView({ profilo }: { profilo: Profilo }) {
  const { statoCategoria } = profilo;

  return (
    <div className="flex max-w-3xl flex-col gap-stack">
      <section
        aria-labelledby="profilo-dati-titolo"
        className="rounded-none border-2 border-primary"
      >
        <div className="bg-primary px-inset py-space-3 text-primary-foreground md:px-inset-lg">
          <h2
            id="profilo-dati-titolo"
            className="font-heading text-xl font-semibold"
          >
            Dati personali
          </h2>
        </div>
        <Tape size={8} />
        <dl className="divide-y divide-border">
          <Riga label="Nome">{profilo.nome || "Non indicato"}</Riga>
          <Riga label="Cognome">{profilo.cognome || "Non indicato"}</Riga>
          <Riga label="Email">
            <span className="font-mono break-all">{profilo.email}</span>
            {profilo.emailConfermata ? (
              <Badge variant="success" icon={<CheckIcon />}>
                Email confermata
              </Badge>
            ) : (
              <Badge variant="warning" icon={<MailWarningIcon />}>
                Email da confermare
              </Badge>
            )}
            {profilo.emailInAttesa ? (
              <div className="flex flex-col items-start gap-space-2 border-l-4 border-tape pl-space-3">
                <Badge variant="warning">Cambio in attesa di conferma</Badge>
                <p className="text-base">
                  Nuova email:{" "}
                  <span className="font-mono break-all">
                    {profilo.emailInAttesa}
                  </span>
                </p>
                <p className="text-base text-muted-foreground">
                  {emailInAttesaMessage(profilo.emailInAttesa, profilo.email)}
                </p>
              </div>
            ) : null}
          </Riga>
          <Riga label="Categoria">
            {profilo.categoria ? (
              <CategoryLabel
                category={CATEGORIA_LABEL[profilo.categoria]}
                className="text-lg"
              />
            ) : (
              "Non indicata"
            )}
            {statoCategoria === "bloccata" ? (
              <>
                <Badge variant="neutral" icon={<LockIcon />}>
                  Categoria bloccata
                </Badge>
                <p className="text-base text-muted-foreground">
                  {PROFILO_MESSAGES.categoria.bloccata}
                </p>
              </>
            ) : null}
            {statoCategoria === "iscrizione_attiva" ? (
              <p className="text-base text-muted-foreground">
                {PROFILO_MESSAGES.categoria.iscrizione_attiva}
              </p>
            ) : null}
          </Riga>
        </dl>
      </section>
      <div className="flex flex-wrap gap-space-3">
        <Link href={PROFILO_MODIFICA_PATH} className={buttonVariants()}>
          Modifica dati
        </Link>
        <Link
          href={IMPOSTAZIONI_PATH}
          className={buttonVariants({ variant: "secondary" })}
        >
          Password, privacy e account
        </Link>
      </div>
    </div>
  );
}
