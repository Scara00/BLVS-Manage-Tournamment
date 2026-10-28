"use client";

import Link from "next/link";
import { startTransition, useActionState, useId, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Fieldset } from "@/components/ui/field";
import {
  CANCELLA_ACCOUNT_MESSAGES,
  initialCancellaAccountState,
  type CancellaAccountAction,
  type CancellaAccountState,
} from "@/lib/account/types";
import { profiloSessionExpiredHref } from "@/lib/profilo/paths";

/**
 * «Cancella l'account» on w-profilo (BLVS-50, R-79). What happens is said
 * before asking; the confirmation is a separate dialog with a tick box,
 * and on success the action leaves for the login page.
 */
export function CancellaAccount({
  action,
  defaultOpen = false,
  initialState = initialCancellaAccountState,
}: {
  /** The `cancellaAccount` server action (a fake in Storybook). */
  action: CancellaAccountAction;
  /** Stories: open the confirmation straight away. */
  defaultOpen?: boolean;
  /** Stories: a result already received. */
  initialState?: CancellaAccountState;
}) {
  const titoloId = useId();
  const [state, formAction, pending] = useActionState(action, initialState);
  const [open, setOpen] = useState(defaultOpen);
  const [spuntata, setSpuntata] = useState(false);
  const [erroreLocale, setErroreLocale] = useState<string | null>(null);
  const errore =
    erroreLocale ?? (state.status === "error" ? state.message : null);

  return (
    <section
      aria-labelledby={titoloId}
      data-testid="cancella-account"
      className="flex flex-col gap-space-3 border-2 border-error-fg p-inset md:p-inset-lg"
    >
      <h2 id={titoloId} className="font-heading text-xl font-semibold">
        Cancella l&apos;account
      </h2>
      <ul className="flex list-disc flex-col gap-space-1 ps-space-5">
        <li>
          Nome, cognome ed email vengono eliminati e non potrai più accedere.
        </li>
        <li>
          I risultati restano nelle classifiche come «Giocatore anonimo», così i
          punti degli altri giocatori non cambiano.
        </li>
        <li>
          Le iscrizioni alle tappe non ancora iniziate vengono ritirate. Con una
          tappa in corso potrai cancellare l&apos;account quando sarà finita.
        </li>
      </ul>
      {state.status === "sessionExpired" ? (
        <p role="alert" className="font-medium">
          {state.message}{" "}
          <Link
            href={profiloSessionExpiredHref()}
            className="font-semibold underline decoration-2 underline-offset-4 focus-ring"
          >
            Accedi di nuovo
          </Link>
        </p>
      ) : null}
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
      >
        <AlertDialogTrigger
          render={<Button variant="secondary" className="self-start" />}
        >
          Cancella l&apos;account
        </AlertDialogTrigger>
        <AlertDialogContent className="max-w-xl">
          <form
            noValidate
            className="contents"
            onSubmit={(event) => {
              event.preventDefault();
              if (pending) return;
              if (!spuntata) {
                setErroreLocale(CANCELLA_ACCOUNT_MESSAGES.conferma);
                return;
              }
              const formData = new FormData(event.currentTarget);
              startTransition(() => formAction(formData));
            }}
          >
            <input type="hidden" name="conferma" value={spuntata ? "1" : ""} />
            <AlertDialogHeader>
              <AlertDialogTitle>Cancellare l&apos;account?</AlertDialogTitle>
              <AlertDialogDescription>
                Non si torna indietro: i tuoi dati personali vengono eliminati
                subito, i risultati restano in forma anonima.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogBody>
              <Fieldset legend="Conferma" required error={errore ?? undefined}>
                <Checkbox
                  label="Ho capito: il mio account viene cancellato e non potrò più accedere."
                  checked={spuntata}
                  onCheckedChange={(checked) => {
                    setSpuntata(checked);
                    if (checked) setErroreLocale(null);
                  }}
                />
              </Fieldset>
            </AlertDialogBody>
            <AlertDialogFooter>
              <AlertDialogCancel className="max-w-full" disabled={pending}>
                Annulla
              </AlertDialogCancel>
              <AlertDialogAction
                type="submit"
                tone="destructive"
                className="max-w-full"
                loading={pending}
                loadingText="Cancellazione…"
              >
                Sì, cancella l&apos;account
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
