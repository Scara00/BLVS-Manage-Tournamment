"use client";

import { AlertCircleIcon, FlagIcon, WifiOffIcon } from "lucide-react";
import Link from "next/link";
import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Tape } from "@/components/scoreboard";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { useOnline } from "@/hooks/use-online";
import type { Categoria } from "@/lib/db/types";
import { CATEGORIA_NOME, CATEGORIA_SEGMENTO } from "@/lib/tappe/avvio/paths";
import {
  CHIUSURA_MESSAGES,
  EFFETTO_CHIUSURA,
} from "@/lib/tappe/chiusura/format";
import {
  initialConcludiTabelloneState,
  type ConcludiTabelloneAction,
  type ConcludiTabelloneState,
} from "@/lib/tappe/chiusura/state";

type ConcludiTabelloneProps = {
  tappaId: string;
  tappaNome: string;
  categoria: Categoria;
  /** The `concludiTabellone` server action (a fake in Storybook). */
  action: ConcludiTabelloneAction;
  /**
   * Why closing is not possible yet (e.g. a final still to play), shown
   * as text; the server refuses it anyway.
   */
  nota?: string | null;
  /** Already concluded (read from the server): only the outcome shows. */
  concluso?: boolean;
  defaultOpen?: boolean;
  offline?: boolean;
  initialState?: ConcludiTabelloneState;
};

/**
 * «Concludi tabellone» (BLVS-43) on w-admin-live, once both finals are
 * played: a confirmation dialog says the effect (points final, overall
 * standing updated). Focus starts on the safe action, «Non concludere».
 * The server re-checks every rule: an open match or tie comes back as a
 * message inside the dialog, with the link to resolve the tie.
 */
export function ConcludiTabellone({
  tappaId,
  tappaNome,
  categoria,
  action,
  nota = null,
  concluso = false,
  defaultOpen = false,
  offline: forceOffline,
  initialState = initialConcludiTabelloneState,
}: ConcludiTabelloneProps) {
  const [open, setOpen] = useState(defaultOpen);
  // The title stays the one it was opened with while it fades out.
  const [nomeNelDialog, setNomeNelDialog] = useState(tappaNome);
  const online = useOnline(
    forceOffline === undefined ? undefined : !forceOffline,
  );
  const ids = useId();
  const esitoRef = useRef<HTMLParagraphElement>(null);

  const safeAction = useCallback<ConcludiTabelloneAction>(
    async (prev, formData) => {
      try {
        return await action(prev, formData);
      } catch (error) {
        console.error("[chiusura] richiesta non riuscita", error);
        return {
          status: "error",
          reason: "network",
          message: CHIUSURA_MESSAGES.network,
          at: prev.status === "idle" ? 1 : prev.at + 1,
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
    if (state.status === "success") setOpen(false);
    if (state.status === "error") setMostraErrore(true);
  }

  // The trigger disappears on success: the message takes the focus.
  useEffect(() => {
    if (state.status !== "success") return;
    const esito = esitoRef.current;
    if (esito) {
      esito.focus({ preventScroll: true });
      esito.scrollIntoView?.({ block: "nearest" });
    }
  }, [state]);

  const categoriaLabel = CATEGORIA_NOME[categoria];
  const errore = state.status === "error" && mostraErrore ? state : null;

  return (
    <section
      aria-labelledby={`${ids}-titolo`}
      className="flex min-w-0 flex-col items-start gap-space-3 border-2 border-primary p-inset [overflow-wrap:anywhere]"
      data-testid="concludi-tabellone"
    >
      <div className="flex w-full flex-col gap-space-1">
        <h2 id={`${ids}-titolo`} className="font-heading text-xl font-semibold">
          Chiusura del tabellone
        </h2>
        <Tape size={4} className="max-w-16" />
      </div>
      {state.status === "success" ? (
        <p
          ref={esitoRef}
          tabIndex={-1}
          role="status"
          data-testid="concludi-tabellone-esito"
          className="font-semibold focus-ring"
        >
          {state.message}
        </p>
      ) : concluso ? (
        <p data-testid="concludi-tabellone-esito" className="font-semibold">
          Il tabellone {categoriaLabel} è concluso: i punti sono definitivi.
        </p>
      ) : (
        <>
          <p>
            Le finali sono giocate. Concludi il tabellone {categoriaLabel} per
            rendere definitivi i punti della tappa.
          </p>
          {nota ? (
            <p id={`${ids}-nota`} className="font-semibold">
              {nota}
            </p>
          ) : null}
          <AlertDialog
            open={open}
            onOpenChange={(next) => {
              if (pending) return;
              if (next) {
                setMostraErrore(false);
                setNomeNelDialog(tappaNome);
              }
              setOpen(next);
            }}
          >
            <AlertDialogTrigger
              render={
                <Button
                  size="campo"
                  className="max-w-full"
                  aria-describedby={nota ? `${ids}-nota` : undefined}
                />
              }
            >
              <FlagIcon aria-hidden />
              Concludi tabellone
            </AlertDialogTrigger>
            <AlertDialogContent data-testid="concludi-tabellone-dialog">
              <form
                action={formAction}
                onSubmit={(event) => {
                  if (!online || pending) event.preventDefault();
                }}
                className="contents"
              >
                <input type="hidden" name="tappaId" value={tappaId} />
                <input
                  type="hidden"
                  name="categoria"
                  value={CATEGORIA_SEGMENTO[categoria]}
                />
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Concludere il tabellone {categoriaLabel}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {nomeNelDialog}. {EFFETTO_CHIUSURA}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogBody className="flex flex-col gap-stack-sm">
                  <p>
                    La fase del tabellone diventa «Conclusa». Una correzione
                    successiva resta possibile, ma chiede una conferma esplicita
                    con l&apos;elenco dei punti che cambiano.
                  </p>
                  {errore ? (
                    <div
                      role="alert"
                      data-testid="concludi-tabellone-errore"
                      className="flex flex-col items-start gap-space-2 border-2 border-error-fg bg-error-bg p-inset text-error-fg"
                    >
                      <p className="flex items-start gap-space-2 font-semibold">
                        <AlertCircleIcon
                          aria-hidden
                          className="mt-1 size-4 shrink-0"
                        />
                        {errore.message}
                      </p>
                      {errore.link ? (
                        <Link
                          href={errore.link.href}
                          onClick={() => setOpen(false)}
                          className={buttonVariants({
                            variant: "secondary",
                            size: "campo",
                            className: "max-w-full",
                          })}
                        >
                          {errore.link.label}
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                  {!online ? (
                    <p
                      id={`${ids}-offline`}
                      className="flex items-start gap-space-2 font-medium"
                    >
                      <WifiOffIcon
                        aria-hidden
                        className="mt-1 size-4 shrink-0"
                      />
                      {CHIUSURA_MESSAGES.offline}
                    </p>
                  ) : null}
                </AlertDialogBody>
                <AlertDialogFooter>
                  <AlertDialogCancel className="max-w-full">
                    Non concludere
                  </AlertDialogCancel>
                  <AlertDialogAction
                    type="submit"
                    className="max-w-full"
                    loading={pending}
                    loadingText="Chiusura…"
                    disabled={!online}
                    aria-describedby={!online ? `${ids}-offline` : undefined}
                  >
                    Sì, concludi il tabellone
                  </AlertDialogAction>
                </AlertDialogFooter>
              </form>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </section>
  );
}
