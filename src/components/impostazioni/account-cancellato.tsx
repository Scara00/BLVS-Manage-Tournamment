import { CheckCircle2Icon } from "lucide-react";
import Link from "next/link";
import { Tape } from "@/components/scoreboard";
import { buttonVariants } from "@/components/ui/button";
import { GIOCATORE_ANONIMO } from "@/lib/cancellazione/anonimo";

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
          Abbiamo eliminato nome, email, password e consensi, e sei uscito da
          questo dispositivo.
        </p>
        <p>
          I risultati delle tappe giocate restano nelle classifiche come «
          {GIOCATORE_ANONIMO}», con la stessa posizione e gli stessi punti.
        </p>
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
