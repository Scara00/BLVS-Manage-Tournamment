import { AlertCircleIcon, LockIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";
import { STATO_TAPPA_LABEL } from "@/lib/tappe/format";
import type { StatoTappa } from "@/lib/db/types";

function Pannello({
  id,
  titolo,
  icona,
  children,
  tono = "error",
}: {
  id: string;
  titolo: string;
  icona: ReactNode;
  children: ReactNode;
  tono?: "error" | "neutral";
}) {
  return (
    <section
      aria-labelledby={id}
      className={
        tono === "error"
          ? "flex max-w-2xl flex-col items-start gap-space-3 border-2 border-error-fg bg-error-bg p-inset text-error-fg md:p-inset-lg"
          : "flex max-w-2xl flex-col items-start gap-space-3 border-2 border-neutral-300 bg-neutral-100 p-inset md:p-inset-lg"
      }
    >
      <h2
        id={id}
        className="flex items-start gap-space-2 font-heading text-xl font-semibold"
      >
        {icona}
        {titolo}
      </h2>
      {children}
    </section>
  );
}

/** Shown in place of the form when the admin session is missing or expired. */
export function TappaModificaSessioneScaduta({ from }: { from: string }) {
  return (
    <Pannello
      id="tappa-modifica-sessione"
      titolo="Sessione scaduta"
      icona={<AlertCircleIcon aria-hidden className="mt-1 size-5 shrink-0" />}
    >
      <p>Per modificare la tappa accedi di nuovo.</p>
      <Link
        href={sessionExpiredHref(from)}
        className={buttonVariants({ variant: "primary" })}
      >
        Accedi di nuovo
      </Link>
    </Pannello>
  );
}

/** A stage in progress, finished or cancelled is read-only here. */
export function TappaNonModificabile({
  nome,
  stato,
  backHref = "/admin/tappe",
}: {
  nome: string;
  stato: StatoTappa;
  backHref?: string;
}) {
  return (
    <Pannello
      id="tappa-modifica-bloccata"
      titolo="Tappa non modificabile"
      tono="neutral"
      icona={<LockIcon aria-hidden className="mt-1 size-5 shrink-0" />}
    >
      <p>
        «{nome}» è nello stato{" "}
        <strong>{STATO_TAPPA_LABEL[stato].toLowerCase()}</strong>: i suoi dati
        non si possono più modificare.
      </p>
      <Link
        href={backHref}
        className={buttonVariants({ variant: "secondary" })}
      >
        Torna alla tappa
      </Link>
    </Pannello>
  );
}
