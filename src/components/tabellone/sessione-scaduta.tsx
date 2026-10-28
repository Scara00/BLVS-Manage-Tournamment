import { AlertCircleIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";
import { tabelloneTappaHref } from "@/lib/tappe/paths";

/** Shown in place of the groups when the session has expired. */
export function TabelloneSessioneScaduta({ tappaId }: { tappaId: string }) {
  return (
    <section
      aria-labelledby="tabellone-sessione-titolo"
      className="flex max-w-2xl flex-col items-start gap-space-3 border-2 border-error-fg bg-error-bg p-inset text-error-fg md:p-inset-lg"
    >
      <h2
        id="tabellone-sessione-titolo"
        className="flex items-start gap-space-2 font-heading text-xl font-semibold"
      >
        <AlertCircleIcon aria-hidden className="mt-1 size-5 shrink-0" />
        Sessione scaduta
      </h2>
      <p>Accedi di nuovo per vedere i gironi e la tua posizione.</p>
      <Link
        href={sessionExpiredHref(tabelloneTappaHref(tappaId))}
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
