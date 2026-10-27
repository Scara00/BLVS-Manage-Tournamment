import { AlertCircleIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";
import { NUOVA_TAPPA_PATH } from "@/lib/tappe/nuova/types";

/** Shown in place of the form when the session is missing or expired. */
export function NuovaTappaSessioneScaduta() {
  return (
    <section
      aria-labelledby="nuova-tappa-sessione-titolo"
      className="flex max-w-2xl flex-col items-start gap-space-3 border-2 border-error-fg bg-error-bg p-inset text-error-fg md:p-inset-lg"
    >
      <h2
        id="nuova-tappa-sessione-titolo"
        className="flex items-start gap-space-2 font-heading text-xl font-semibold"
      >
        <AlertCircleIcon aria-hidden className="mt-1 size-5 shrink-0" />
        Sessione scaduta
      </h2>
      <p>Per creare una tappa accedi di nuovo.</p>
      <Link
        href={sessionExpiredHref(NUOVA_TAPPA_PATH)}
        className={buttonVariants({ variant: "primary" })}
      >
        Accedi di nuovo
      </Link>
    </section>
  );
}
