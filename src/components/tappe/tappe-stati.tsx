import { AlertCircleIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";
import { TAPPE_PATH } from "@/lib/tappe/paths";

/** Suspense fallback while the stages are read (state: loading). */
export function TappeLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-stack-sm">
      <p className="text-muted-foreground">Caricamento delle tappe…</p>
      <div aria-hidden="true" className="flex flex-col gap-space-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="block h-12 w-full bg-neutral-100" />
        ))}
      </div>
    </div>
  );
}

/** Shown in place of the list when the session has expired. */
export function TappeSessioneScaduta() {
  return (
    <section
      aria-labelledby="tappe-sessione-titolo"
      className="flex max-w-2xl flex-col items-start gap-space-3 border-2 border-error-fg bg-error-bg p-inset text-error-fg md:p-inset-lg"
    >
      <h2
        id="tappe-sessione-titolo"
        className="flex items-start gap-space-2 font-heading text-xl font-semibold"
      >
        <AlertCircleIcon aria-hidden className="mt-1 size-5 shrink-0" />
        Sessione scaduta
      </h2>
      <p>Accedi di nuovo per vedere i posti liberi nella tua categoria.</p>
      <Link
        href={sessionExpiredHref(TAPPE_PATH)}
        className={buttonVariants({
          variant: "primary",
          className: "max-w-full",
        })}
      >
        Accedi di nuovo
      </Link>
    </section>
  );
}
