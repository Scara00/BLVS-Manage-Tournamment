import { CheckCircle2Icon } from "lucide-react";
import Link from "next/link";
import { Tape } from "@/components/scoreboard";
import { buttonVariants } from "@/components/ui/button";

/**
 * w-account-eliminato: the account no longer exists and this device is
 * signed out. The h1 is «Account cancellato».
 */
export function AccountCancellato() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-stack-lg px-inset py-space-7 md:px-inset-lg">
      <header className="flex flex-col gap-space-3">
        <h1 className="flex items-start gap-space-3 font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          <CheckCircle2Icon aria-hidden className="mt-1 size-8 shrink-0" />
          <span className="min-w-0 [overflow-wrap:anywhere]">
            Account cancellato
          </span>
        </h1>
        <Tape size={8} className="max-w-32" />
      </header>
      <div className="flex max-w-prose flex-col gap-space-3 text-lg">
        <p>
          Abbiamo eliminato il tuo account con iscrizioni e risultati, e sei
          uscito da questo dispositivo.
        </p>
        <p>Le classifiche ora sono calcolate senza di te.</p>
      </div>
      <div className="flex flex-col items-start gap-space-3 sm:flex-row sm:flex-wrap">
        <Link href="/classifica" className={buttonVariants()}>
          Vai alla classifica
        </Link>
        <Link href="/" className={buttonVariants({ variant: "secondary" })}>
          Torna alla home
        </Link>
      </div>
    </div>
  );
}
