import Link from "next/link";
import type { ReactNode } from "react";
import { Tape } from "@/components/scoreboard";
import { GIOCATORE_ANONIMO } from "@/lib/cancellazione/anonimo";
import { buttonVariants } from "@/components/ui/button";
import {
  ELIMINA_ACCOUNT_PATH,
  type CambioPasswordAction,
  type CambioPasswordState,
  type ConsensoPrivacy,
  type Impostazioni,
} from "@/lib/impostazioni/types";
import { formatPolicyDate } from "@/lib/legal/privacy-policy";
import { formatServerTime } from "@/lib/time/server-time";
import { cn } from "@/lib/utils";
import { CambioPasswordForm } from "./cambio-password-form";
import { RigaPubblica, titoloClassifica } from "./riga-pubblica";

function Sezione({
  id,
  title,
  description,
  tone = "default",
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  tone?: "default" | "error";
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-titolo`}
      className={cn(
        "flex flex-col gap-space-5 border-2 p-inset md:p-inset-lg",
        tone === "error" ? "border-error-fg" : "border-primary",
      )}
    >
      <div className="flex flex-col gap-space-2">
        <h2 id={`${id}-titolo`} className="font-heading text-2xl font-semibold">
          {title}
        </h2>
        <Tape size={4} className="max-w-24" />
        {description ? (
          <div className="max-w-prose text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** «27 ottobre 2026 alle ore 17:42» (Rome time): when the consent was given. */
function momentoConsenso(iso: string): string {
  return formatServerTime(new Date(iso), {
    dateStyle: "long",
    timeStyle: "short",
  });
}

function Consenso({ consenso }: { consenso: ConsensoPrivacy | null }) {
  if (!consenso) {
    return (
      <p className="max-w-prose">
        Non troviamo il consenso dato all&apos;iscrizione. Leggi
        l&apos;informativa e, per qualsiasi dubbio, scrivi al titolare indicato
        lì.
      </p>
    );
  }
  return (
    <dl className="grid max-w-xl gap-x-space-5 gap-y-space-3 sm:grid-cols-[auto_minmax(0,1fr)]">
      <dt className="font-heading font-semibold">Informativa privacy</dt>
      <dd>
        versione <span className="font-mono">{consenso.versione}</span>
        {consenso.dataInformativa ? (
          <>
            {" "}
            del{" "}
            <span className="font-mono">
              {formatPolicyDate(consenso.dataInformativa)}
            </span>
          </>
        ) : null}
      </dd>
      <dt className="font-heading font-semibold">Accettata il</dt>
      <dd>
        <time dateTime={consenso.accettatoIl} className="font-mono">
          {momentoConsenso(consenso.accettatoIl)}
        </time>
      </dd>
    </dl>
  );
}

/**
 * w-impostazioni: password change, the consent given (with the row the
 * public sees in the overall standing) and the way to delete the account.
 */
export function ImpostazioniView({
  impostazioni,
  cambiaPassword,
  statoPassword,
}: {
  impostazioni: Impostazioni;
  cambiaPassword: CambioPasswordAction;
  /** Starting state of the password form (Storybook). */
  statoPassword?: CambioPasswordState;
}) {
  const { riga } = impostazioni;
  return (
    <div className="flex max-w-3xl flex-col gap-stack-lg">
      <Sezione
        id="impostazioni-password"
        title="Password"
        description={
          <p>
            Per sceglierne una nuova serve quella attuale. Account:{" "}
            <span className="font-mono [overflow-wrap:anywhere] text-foreground">
              {impostazioni.email}
            </span>
          </p>
        }
      >
        <CambioPasswordForm
          action={cambiaPassword}
          initialState={statoPassword}
        />
      </Sezione>

      <Sezione
        id="impostazioni-consenso"
        title="Consenso e dati pubblici"
        description={
          <p>
            Il consenso che hai dato iscrivendoti e quello che chiunque vede di
            te nelle classifiche.
          </p>
        }
      >
        <Consenso consenso={impostazioni.consenso} />
        <div className="flex flex-col gap-space-3">
          <h3 className="font-heading text-lg font-semibold">
            La tua riga pubblica
          </h3>
          {riga ? (
            <RigaPubblica
              caption={titoloClassifica(riga.categoria, riga.stagione)}
              riga={riga.prima}
              mio
              className="max-w-xl"
            />
          ) : (
            <p className="max-w-prose">
              Non sei ancora nella classifica generale: comparirai con nome,
              cognome e punti dopo la prima tappa giocata.
            </p>
          )}
          <p className="max-w-prose text-sm text-muted-foreground">
            Nelle classifiche e nelle pagine live compaiono solo nome, cognome e
            risultati, mai l&apos;email.
          </p>
        </div>
        <Link
          href="/privacy#cosa-e-pubblico"
          className="self-start font-heading font-semibold underline decoration-2 underline-offset-4 focus-ring"
        >
          Leggi l&apos;informativa privacy
        </Link>
      </Sezione>

      <Sezione
        id="impostazioni-cancellazione"
        title="Cancella l'account"
        tone="error"
        description={
          <p>
            Eliminiamo nome, email, password e consensi. I tuoi risultati
            restano nelle classifiche come «{GIOCATORE_ANONIMO}», con la stessa
            posizione e gli stessi punti. Prima di confermare vedi cosa cambia.
          </p>
        }
      >
        <Link
          href={ELIMINA_ACCOUNT_PATH}
          className={cn(
            buttonVariants({ variant: "secondary" }),
            "self-start border-error-fg text-error-fg",
          )}
        >
          Cancella l&apos;account…
        </Link>
      </Sezione>
    </div>
  );
}
