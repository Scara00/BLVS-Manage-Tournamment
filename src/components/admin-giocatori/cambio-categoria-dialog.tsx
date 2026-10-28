"use client";

import { AlertCircleIcon, BanIcon } from "lucide-react";
import Link from "next/link";
import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { effettiAttesi, testiEffetti } from "@/lib/giocatori/admin/effetti";
import { CAMBIO_MESSAGES } from "@/lib/giocatori/admin/errori";
import { giocatoreAdminPath } from "@/lib/giocatori/admin/paths";
import {
  CAMBIO_CATEGORIA_INITIAL,
  type CambioCategoriaAction,
  type CambioCategoriaState,
  type EffettiCambio,
} from "@/lib/giocatori/admin/types";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";
import { CATEGORIA_LABEL } from "@/lib/tappe/dettaglio";

export type EsitoCambio = { cambiata: boolean; message?: string };

type CambioCategoriaDialogProps = {
  utenteId: string;
  /** «Luca Rossi». */
  nome: string;
  /** The change asked for, `null` when closed. Fresh from the page on every render. */
  effetti: EffettiCambio | null;
  onClose: (esito: EsitoCambio) => void;
  /** The button that opened it: focus returns there on «Annulla». */
  returnFocus: React.RefObject<HTMLElement | null>;
  /** Where focus goes after a change. */
  esitoId: string;
  /** The `cambiaCategoria` server action (a fake in Storybook). */
  action: CambioCategoriaAction;
  initialState?: CambioCategoriaState;
};

/** Max length of the note, as in the action. */
export const NOTA_CAMBIO_MAX = 400;

/**
 * w-admin-categoria-conferma: what the change does (future registrations
 * and seats, points moved per season), then «Sì, cambia». Focus starts on
 * «Annulla»; Esc and «Annulla» change nothing and give focus back to the
 * button. A stage in progress blocks the change and says why. If the
 * effects changed meanwhile, the page re-reads them and the dialog shows
 * the new ones with an alert; the admin confirms again.
 */
export function CambioCategoriaDialog({
  utenteId,
  nome,
  effetti,
  onClose,
  returnFocus,
  esitoId,
  action,
  initialState = CAMBIO_CATEGORIA_INITIAL,
}: CambioCategoriaDialogProps) {
  const toast = useToast();
  // The content stays on the change it was opened for while it fades.
  const [mostrato, setMostrato] = useState(effetti);
  const cambiata = useRef(false);
  const gestito = useRef<CambioCategoriaState | null>(null);

  const safeAction = useCallback<CambioCategoriaAction>(
    async (prev, formData) => {
      try {
        return await action(prev, formData);
      } catch (error) {
        console.error("[giocatori] cambio di categoria non riuscito", error);
        return {
          status: "error",
          reason: "network",
          message: CAMBIO_MESSAGES.network,
          at: 0,
        };
      }
    },
    [action],
  );
  const [state, formAction, pending] = useActionState(safeAction, initialState);

  const [visto, setVisto] = useState(state);
  const [mostraErrore, setMostraErrore] = useState(
    initialState.status === "error",
  );
  if (state !== visto) {
    setVisto(state);
    if (state.status === "error") setMostraErrore(true);
  }
  const aperto = effetti !== null;
  const [eraAperto, setEraAperto] = useState(aperto);
  if (aperto !== eraAperto) {
    setEraAperto(aperto);
    // A new opening starts without the previous attempt's error.
    if (aperto && initialState.status !== "error") setMostraErrore(false);
  }
  if (effetti && effetti !== mostrato) setMostrato(effetti);

  useEffect(() => {
    if (state.status !== "success" || gestito.current === state) return;
    gestito.current = state;
    cambiata.current = true;
    toast.add({ title: state.message });
    onClose({ cambiata: true, message: state.message });
  }, [state, toast, onClose]);

  const dati = effetti ?? mostrato;
  const errore = state.status === "error" && mostraErrore ? state : null;
  const testi = dati ? testiEffetti(dati) : null;
  const bloccato = (dati?.bloccanti.length ?? 0) > 0;

  return (
    <AlertDialog
      open={aperto}
      onOpenChange={(next) => {
        if (pending || next) return;
        onClose({ cambiata: false });
      }}
    >
      <AlertDialogContent
        className="max-w-2xl"
        data-testid="cambio-categoria-dialog"
        finalFocus={() => {
          const dopo = cambiata.current;
          cambiata.current = false;
          if (dopo) return document.getElementById(esitoId) ?? true;
          return returnFocus.current ?? true;
        }}
      >
        {dati && testi ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (pending || bloccato) return;
              const formData = new FormData(event.currentTarget);
              startTransition(() => formAction(formData));
            }}
            className="contents"
          >
            <input type="hidden" name="utenteId" value={utenteId} />
            <input type="hidden" name="categoria" value={dati.a} />
            <input
              type="hidden"
              name="attesi"
              value={JSON.stringify(effettiAttesi(dati))}
            />
            <AlertDialogHeader>
              <AlertDialogTitle>
                Cambiare la categoria di {nome} in{" "}
                {CATEGORIA_LABEL[dati.a].toLowerCase()}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {dati.da
                  ? `Da ${CATEGORIA_LABEL[dati.da]} a ${CATEGORIA_LABEL[dati.a]}.`
                  : `Categoria finora non indicata: diventa ${CATEGORIA_LABEL[dati.a]}.`}{" "}
                Le classifiche delle tappe già giocate non cambiano: restano sul
                tabellone in cui ha giocato.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogBody className="flex flex-col gap-space-4">
              {errore ? (
                <div
                  role="alert"
                  data-testid="cambio-categoria-errore"
                  className="flex flex-col items-start gap-space-2 border-2 border-error-fg bg-error-bg p-inset text-error-fg"
                >
                  <p className="flex items-start gap-space-2 font-semibold">
                    <AlertCircleIcon
                      aria-hidden
                      className="mt-1 size-4 shrink-0"
                    />
                    {errore.message}
                  </p>
                  {errore.reason === "sessionExpired" ? (
                    <Link
                      href={sessionExpiredHref(giocatoreAdminPath(utenteId))}
                      className={buttonVariants({ variant: "primary" })}
                    >
                      Accedi di nuovo
                    </Link>
                  ) : null}
                </div>
              ) : null}
              {bloccato ? (
                <div
                  data-testid="cambio-categoria-bloccato"
                  className="flex flex-col gap-space-2 border-2 border-primary bg-tape p-inset text-primary"
                >
                  <p className="flex items-start gap-space-2 font-semibold">
                    <BanIcon aria-hidden className="mt-1 size-4 shrink-0" />
                    Il cambio non è possibile adesso.
                  </p>
                  <ul className="flex list-disc flex-col gap-space-1 pl-space-5">
                    {testi.bloccanti.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <section
                aria-labelledby="cambio-iscrizioni"
                className="flex flex-col gap-space-2"
              >
                <h3
                  id="cambio-iscrizioni"
                  className="font-heading font-semibold"
                >
                  Iscrizioni a tappe future e posti
                </h3>
                <ul
                  data-testid="cambio-effetti-iscrizioni"
                  className="flex list-disc flex-col gap-space-2 pl-space-5 [&_li]:break-words"
                >
                  {testi.iscrizioni.map((t, i) => (
                    <li
                      key={t}
                      data-oltre-massimo={
                        dati.iscrizioni[i]?.oltreMassimo ? "true" : undefined
                      }
                    >
                      {t}
                    </li>
                  ))}
                </ul>
              </section>
              <section
                aria-labelledby="cambio-punti"
                className="flex flex-col gap-space-2"
              >
                <h3 id="cambio-punti" className="font-heading font-semibold">
                  Punti in classifica generale
                </h3>
                <ul
                  data-testid="cambio-effetti-punti"
                  className="flex list-disc flex-col gap-space-2 pl-space-5 font-mono text-sm [&_li]:break-words"
                >
                  {testi.punti.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <p className="text-sm">
                  Dopo il cambio la classifica generale di ogni stagione si
                  ricalcola e il cambio va nel registro.
                </p>
              </section>
              {bloccato ? null : (
                <Field
                  label="Nota per il registro (facoltativa)"
                  hint={`Il motivo del cambio, massimo ${NOTA_CAMBIO_MAX} caratteri.`}
                >
                  <Textarea name="nota" maxLength={NOTA_CAMBIO_MAX} rows={2} />
                </Field>
              )}
            </AlertDialogBody>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              {bloccato ? null : (
                <AlertDialogAction
                  type="submit"
                  loading={pending}
                  loadingText="Cambio in corso…"
                >
                  Sì, cambia in {CATEGORIA_LABEL[dati.a].toLowerCase()}
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </form>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}
