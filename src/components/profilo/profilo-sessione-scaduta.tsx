import { AlertCircleIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { profiloSessionExpiredHref } from "@/lib/profilo/paths";

/** Shown in place of the profile when the session is missing or expired. */
export function ProfiloSessioneScaduta({ from }: { from: string }) {
  return (
    <section
      aria-labelledby="profilo-sessione-titolo"
      className="flex max-w-2xl flex-col items-start gap-space-3 border-2 border-error-fg bg-error-bg p-inset text-error-fg md:p-inset-lg"
    >
      <h2
        id="profilo-sessione-titolo"
        className="flex items-start gap-space-2 font-heading text-xl font-semibold"
      >
        <AlertCircleIcon aria-hidden className="mt-1 size-5 shrink-0" />
        Sessione scaduta
      </h2>
      <p>Per vedere e modificare i tuoi dati accedi di nuovo.</p>
      <Link
        href={profiloSessionExpiredHref(from)}
        className={buttonVariants({ variant: "primary" })}
      >
        Accedi di nuovo
      </Link>
    </section>
  );
}
