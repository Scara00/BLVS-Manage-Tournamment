import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { MIE_ISCRIZIONI_PATH } from "@/lib/iscrizioni/mie/paths";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";

/** Suspense fallback while the registrations are read. */
export function MieIscrizioniLoading() {
  return (
    <div
      aria-busy="true"
      className="flex max-w-3xl flex-col gap-space-3 border-2 border-neutral-200 p-inset md:p-inset-lg"
    >
      <p role="status" className="flex items-center gap-space-2">
        <Loader2Icon
          aria-hidden
          className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
        />
        Caricamento delle tue iscrizioni…
      </p>
      <div aria-hidden className="flex flex-col gap-space-3">
        <span className="block h-6 w-1/2 bg-neutral-100" />
        <span className="block h-6 w-2/3 bg-neutral-100" />
        <span className="block h-6 w-1/3 bg-neutral-100" />
      </div>
    </div>
  );
}

/** Shown in place of the list when the session is missing or expired. */
export function MieIscrizioniSessioneScaduta() {
  return (
    <section
      aria-labelledby="mie-iscrizioni-sessione-titolo"
      className="flex max-w-2xl flex-col items-start gap-space-3 border-2 border-error-fg bg-error-bg p-inset text-error-fg md:p-inset-lg"
    >
      <h2
        id="mie-iscrizioni-sessione-titolo"
        className="flex items-start gap-space-2 font-heading text-xl font-semibold"
      >
        <AlertCircleIcon aria-hidden className="mt-1 size-5 shrink-0" />
        Sessione scaduta
      </h2>
      <p>Per vedere e annullare le tue iscrizioni accedi di nuovo.</p>
      <Link
        href={sessionExpiredHref(MIE_ISCRIZIONI_PATH)}
        className={buttonVariants({ variant: "primary" })}
      >
        Accedi di nuovo
      </Link>
    </section>
  );
}
