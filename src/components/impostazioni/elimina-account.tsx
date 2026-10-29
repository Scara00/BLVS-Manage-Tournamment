"use client";

import { AlertCircleIcon } from "lucide-react";
import Link from "next/link";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { Tape } from "@/components/scoreboard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, focusFirstInvalid } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PAROLA_CONFERMA, confermaValida } from "@/lib/cancellazione/anonimo";
import {
  ELIMINA_ACCOUNT_PATH,
  IMPOSTAZIONI_MESSAGES,
  IMPOSTAZIONI_PATH,
  initialCancellazioneState,
  type CancellazioneAction,
  type CancellazioneState,
  type RigaPubblica as DatiRigaPubblica,
} from "@/lib/impostazioni/types";
import { profiloSessionExpiredHref } from "@/lib/profilo/paths";
import { RigaPubblica, titoloClassifica } from "./riga-pubblica";

/** The player's row in the overall standing, which the deletion removes. */
export function RigaCheSparisce({ riga }: { riga: DatiRigaPubblica | null }) {
  if (!riga) {
    return (
      <p className="max-w-prose">
        Non sei ancora nella classifica generale. Se hai già giocato qualche
        partita, la cancellazione toglie anche quella dalle classifiche delle
        tappe.
      </p>
    );
  }
  const titolo = titoloClassifica(riga.categoria, riga.stagione);
  return (
    <div className="flex flex-col gap-space-3">
      <RigaPubblica caption={titolo} riga={riga.attuale} mio />
      <p className="max-w-prose font-semibold">
        Con la cancellazione questa riga sparisce e la classifica si ricalcola
        senza di te: chi è dietro di te sale, e i punti di chi ha giocato con te
        o contro di te possono cambiare.
      </p>
    </div>
  );
}

/**
 * w-elimina-account: the row that disappears from the overall standing,
 * what is deleted and what changes for the others, then «ELIMINA» typed in
 * a field and one more confirmation in a dialog. Only the dialog's button
 * calls the action.
 */
export function EliminaAccount({
  riga,
  action,
  initialState = initialCancellazioneState,
  dialogoAperto = false,
}: {
  riga: DatiRigaPubblica | null;
  /** The `cancellaAccount` server action (a fake in Storybook). */
  action: CancellazioneAction;
  initialState?: CancellazioneState;
  /** Opens the dialog at once (Storybook). */
  dialogoAperto?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [conferma, setConferma] = useState(
    dialogoAperto ? PAROLA_CONFERMA : "",
  );
  const [aperto, setAperto] = useState(dialogoAperto);
  const [erroreLocale, setErroreLocale] = useState<string | null>(null);
  const [tentativi, setTentativi] = useState(0);

  // A new result from the server closes the dialog (adjusting in render).
  const [statoVisto, setStatoVisto] = useState(state);
  if (state !== statoVisto) {
    setStatoVisto(state);
    setAperto(false);
  }

  useEffect(() => {
    if ((tentativi > 0 || state.status === "error") && formRef.current)
      focusFirstInvalid(formRef.current);
  }, [tentativi, state]);

  const erroreCampo =
    erroreLocale ??
    (state.status === "error" ? state.fields.conferma : undefined);
  const erroreGenerale =
    state.status === "error" && !state.fields.conferma ? state.message : null;

  return (
    <div className="flex max-w-3xl flex-col gap-stack-lg">
      <section
        aria-labelledby="elimina-anteprima-titolo"
        className="flex flex-col gap-space-4"
      >
        <div className="flex flex-col gap-space-2">
          <h2
            id="elimina-anteprima-titolo"
            className="font-heading text-2xl font-semibold"
          >
            La tua riga in classifica
          </h2>
          <Tape size={4} className="max-w-24" />
        </div>
        <RigaCheSparisce riga={riga} />
      </section>

      <section
        aria-labelledby="elimina-cosa-titolo"
        className="grid gap-space-5 md:grid-cols-2"
      >
        <h2 id="elimina-cosa-titolo" className="sr-only">
          Cosa succede
        </h2>
        <div className="flex flex-col gap-space-2 border-l-4 border-error-fg pl-space-4">
          <h3 className="font-heading text-lg font-semibold">
            Cosa eliminiamo
          </h3>
          <ul className="list-disc pl-space-5">
            <li>nome e cognome</li>
            <li>email</li>
            <li>password e accesso</li>
            <li>i consensi che hai dato</li>
            <li>tutte le tue iscrizioni, anche alle tappe già giocate</li>
            <li>i tuoi risultati, in ogni classifica</li>
          </ul>
        </div>
        <div className="flex flex-col gap-space-2 border-l-4 border-primary pl-space-4">
          <h3 className="font-heading text-lg font-semibold">
            Cosa cambia per gli altri
          </h3>
          <ul className="list-disc pl-space-5">
            <li>le partite giocate con te restano, senza di te</li>
            <li>le classifiche di tappa e generale si ricalcolano</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Non si torna indietro: per giocare di nuovo dovrai creare un nuovo
            account.
          </p>
        </div>
      </section>

      <form
        ref={formRef}
        noValidate
        aria-labelledby="elimina-conferma-titolo"
        className="flex flex-col gap-space-5 border-2 border-error-fg p-inset md:p-inset-lg"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          if (!confermaValida(conferma)) {
            setErroreLocale(
              conferma.trim()
                ? IMPOSTAZIONI_MESSAGES.confermaErrata
                : IMPOSTAZIONI_MESSAGES.confermaMancante,
            );
            setTentativi((n) => n + 1);
            return;
          }
          setErroreLocale(null);
          setAperto(true);
        }}
      >
        <h2
          id="elimina-conferma-titolo"
          className="font-heading text-2xl font-semibold"
        >
          Conferma la cancellazione
        </h2>

        {state.status === "sessionExpired" ? (
          <div
            role="alert"
            className="flex flex-col items-start gap-space-3 border-2 border-error-fg bg-error-bg p-inset text-error-fg"
          >
            <p className="flex items-start gap-space-2 font-semibold">
              <AlertCircleIcon aria-hidden className="mt-1 size-4 shrink-0" />
              {state.message}
            </p>
            <Link
              href={profiloSessionExpiredHref(ELIMINA_ACCOUNT_PATH)}
              className={buttonVariants({ variant: "primary" })}
            >
              Accedi di nuovo
            </Link>
          </div>
        ) : null}

        <Field
          label={`Scrivi ${PAROLA_CONFERMA} per confermare`}
          required
          error={erroreCampo}
          className="max-w-md"
        >
          <Input
            name="conferma"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="font-mono"
            value={conferma}
            onValueChange={(value) => {
              setConferma(value);
              setErroreLocale(null);
            }}
          />
        </Field>

        {erroreGenerale ? (
          <p
            role="alert"
            className="flex items-start gap-space-2 font-semibold text-error-fg"
          >
            <AlertCircleIcon aria-hidden className="mt-1 size-4 shrink-0" />
            {erroreGenerale}
          </p>
        ) : null}

        <div className="flex flex-col items-start gap-space-3 sm:flex-row sm:flex-wrap">
          <Button type="submit" variant="destructive" loading={pending}>
            Cancella l&apos;account
          </Button>
          <Link
            href={IMPOSTAZIONI_PATH}
            className={buttonVariants({ variant: "secondary" })}
          >
            Annulla
          </Link>
        </div>
      </form>

      <AlertDialog
        open={aperto}
        onOpenChange={(next) => {
          if (pending) return;
          setAperto(next);
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <form
            className="contents"
            onSubmit={(event) => {
              event.preventDefault();
              if (pending) return;
              const formData = new FormData();
              formData.set("conferma", conferma);
              startTransition(() => formAction(formData));
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>Cancellare l&apos;account?</AlertDialogTitle>
              <AlertDialogDescription>
                Account, iscrizioni e risultati vengono eliminati subito e non
                si recuperano. Sparisci da tutte le classifiche.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>No, tieni l&apos;account</AlertDialogCancel>
              <AlertDialogAction
                type="submit"
                tone="destructive"
                loading={pending}
                loadingText="Cancellazione…"
              >
                Sì, cancella l&apos;account
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
