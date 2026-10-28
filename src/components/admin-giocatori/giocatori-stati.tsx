import { AlertCircleIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";

export function GiocatoriSessioneScaduta({ from }: { from: string }) {
  return (
    <section
      aria-labelledby="giocatori-sessione"
      className="flex flex-col items-start gap-space-3 border-2 border-error-fg bg-error-bg p-inset text-error-fg"
    >
      <h2
        id="giocatori-sessione"
        className="flex items-start gap-space-2 font-heading text-xl font-semibold"
      >
        <AlertCircleIcon aria-hidden className="mt-1 size-5 shrink-0" />
        Sessione scaduta
      </h2>
      <p>Per vedere e modificare i giocatori accedi di nuovo.</p>
      <Link
        href={sessionExpiredHref(from)}
        className={buttonVariants({ variant: "primary" })}
      >
        Accedi di nuovo
      </Link>
    </section>
  );
}

export function GiocatoriLoading({ testo }: { testo: string }) {
  return (
    <p className="text-muted-foreground" aria-busy="true">
      {testo}
    </p>
  );
}
