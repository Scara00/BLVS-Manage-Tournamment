"use client";

import {
  AlertCircleIcon,
  ArrowRightIcon,
  TriangleAlertIcon,
} from "lucide-react";
import Link from "next/link";
import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { FaseMarker } from "@/components/admin-gironi/legenda-fasi";
import {
  AlertDialog,
  AlertDialogAction,
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
import { coloreGirone, FASE_GIOCO_LABEL } from "@/lib/gironi/fasi/fase";
import type { GironeProposto } from "@/lib/gironi/fasi/qualificazione";
import {
  initialProssimaFaseState,
  PROSSIMA_FASE_MESSAGES as M,
  type ProssimaFaseAction,
  type ProssimaFaseState,
  type ProssimaFaseView,
} from "@/lib/gironi/fasi/types";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";
import {
  avvioFasePath,
  CATEGORIA_NOME,
  CATEGORIA_SEGMENTO,
  gironiPath,
} from "@/lib/tappe/avvio/paths";
import { adminLivePath } from "@/lib/tappe/live-admin/paths";

type ProssimaFaseProps = {
  view: ProssimaFaseView;
  /** The `proponiProssimaFase` server action (a fake in Storybook). */
  action: ProssimaFaseAction;
  /** Storybook/axe: open the confirmation, force offline, starting state. */
  defaultOpen?: boolean;
  offline?: boolean;
  initialState?: ProssimaFaseState;
};

const TITOLO = {
  gold_silver: "Gironi gold e silver",
  finali: "Finali gold e silver",
} as const;

const AZIONE = {
  gold_silver: "Proponi i gironi gold e silver",
  finali: "Genera le finali",
} as const;

function focusOn(el: HTMLElement | null) {
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView?.({ block: "nearest" });
}

/** The board's phase, always as text, on tape. */
function FaseTabellone({ view }: { view: ProssimaFaseView }) {
  return (
    <p className="flex flex-wrap items-center gap-space-2">
      <span className="text-sm">Fase del tabellone:</span>
      <span
        data-testid="fase-tabellone"
        className="bg-tape px-space-2 py-space-1 font-mono text-sm font-semibold [overflow-wrap:anywhere] text-primary"
      >
        {view.faseGioco ? FASE_GIOCO_LABEL[view.faseGioco] : "Non avviata"}
      </span>
    </p>
  );
}

/** One proposed group: its mark, its name, and where each player comes from. */
function GironeAnteprima({ girone }: { girone: GironeProposto }) {
  const colore = coloreGirone(girone.fase);
  return (
    <li
      className="flex flex-col gap-space-2 border-2 border-primary p-inset"
      data-testid="girone-proposto"
      data-fase={girone.fase}
    >
      <p className="flex items-center gap-space-2 font-heading font-semibold [overflow-wrap:anywhere]">
        {colore ? <FaseMarker fase={colore} /> : null}
        {girone.nome}
      </p>
      <ul className="flex flex-col gap-space-1">
        {girone.giocatori.map((g) => (
          <li
            key={g.iscrizioneId}
            className="flex flex-wrap items-baseline justify-between gap-x-space-3"
          >
            <span className="[overflow-wrap:anywhere]">{g.nome}</span>
            <span className="font-mono text-sm">{g.provenienza}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}

/**
 * The step after a group phase of one board (BLVS-39). On w-admin-gironi
 * it proposes the gold groups (1st and 2nd of every initial group) and the
 * silver ones (3rd and 4th), which the admin then checks and changes in
 * the editor below before starting them. On w-admin-avvio-fase it
 * generates the gold and silver finals. An open tie blocks both, with a
 * «Risolvi parità» link for each tied group.
 */
export function ProssimaFase({
  view,
  action,
  defaultOpen = false,
  offline: forceOffline,
  initialState = initialProssimaFaseState,
}: ProssimaFaseProps) {
  const [open, setOpen] = useState(defaultOpen);
  const online = useOnline(
    forceOffline === undefined ? undefined : !forceOffline,
  );
  const esitoRef = useRef<HTMLParagraphElement>(null);

  const safeAction = useCallback<ProssimaFaseAction>(
    async (prev, formData) => {
      try {
        return await action(prev, formData);
      } catch (error) {
        console.error("[fasi] richiesta non riuscita", error);
        return {
          status: "error",
          reason: "network",
          message: M.network,
          at: prev.status === "idle" ? 1 : prev.at + 1,
        };
      }
    },
    [action],
  );
  const [state, formAction, pending] = useActionState(safeAction, initialState);

  const [visto, setVisto] = useState(state);
  if (state !== visto) {
    setVisto(state);
    if (state.status !== "idle") setOpen(false);
  }

  // The message comes with the refreshed page, possibly after the state:
  // focus it as soon as it is there.
  const fuocoDopo = useRef(false);
  useEffect(() => {
    if (state.status !== "idle") fuocoDopo.current = true;
  }, [state]);
  useEffect(() => {
    if (fuocoDopo.current && esitoRef.current) {
      fuocoDopo.current = false;
      focusOn(esitoRef.current);
    }
  }, [state, view.stato]);

  const titoloId = `prossima-fase-${view.tipo}`;
  const offlineReason = online ? null : M.offline;
  const errore = state.status === "error" ? state : null;
  const tabellone = `tabellone ${CATEGORIA_NOME[view.categoria]}`;

  let corpo;
  switch (view.stato) {
    case "in_corso":
      corpo = (
        <div className="flex flex-col gap-space-2">
          <p>{M.inCorso}</p>
          <ul className="list-disc ps-space-5">
            {view.gironi.map((g) => (
              <li key={g.id}>{g.nome}: partite da concludere</li>
            ))}
          </ul>
        </div>
      );
      break;
    case "parita":
      corpo = (
        <div
          className="flex flex-col gap-space-2 border-2 border-warning-fg bg-warning-bg p-inset text-warning-fg"
          data-testid="parita-da-risolvere"
        >
          <p className="flex items-start gap-space-2 font-semibold">
            <TriangleAlertIcon aria-hidden className="mt-1 size-4 shrink-0" />
            {M.parita}
          </p>
          <ul className="flex flex-col gap-space-2">
            {view.gironi.map((g) => (
              <li
                key={g.id}
                className="flex flex-wrap items-center gap-x-space-3 gap-y-space-1"
              >
                <span className="font-semibold [overflow-wrap:anywhere]">
                  {g.nome}
                </span>
                <Link
                  href={g.href}
                  aria-label={`Risolvi parità nel ${g.nome}`}
                  className={buttonVariants({
                    variant: "secondary",
                    size: "sm",
                    className: "max-w-full",
                  })}
                >
                  Risolvi parità
                </Link>
              </li>
            ))}
          </ul>
        </div>
      );
      break;
    case "non_componibile":
      corpo = <p className="font-semibold">{view.messaggio}</p>;
      break;
    case "proposta":
      corpo = (
        <div className="flex flex-col items-start gap-space-2">
          <p
            ref={esitoRef}
            tabIndex={-1}
            className="font-semibold focus-ring"
            data-testid="prossima-fase-esito"
          >
            {M.propostaSalvata}
          </p>
          <Link
            href={avvioFasePath(view.tappa.id, view.categoria)}
            className={buttonVariants({
              variant: "primary",
              className: "max-w-full",
            })}
          >
            Vai all&apos;avvio dei gironi gold e silver
            <ArrowRightIcon aria-hidden />
          </Link>
        </div>
      );
      break;
    case "fatta":
      corpo = (
        <div className="flex flex-col items-start gap-space-2">
          <p
            ref={esitoRef}
            tabIndex={-1}
            className="font-semibold focus-ring"
            data-testid="prossima-fase-esito"
          >
            {M.finaliGenerate}
          </p>
          <Link
            href={adminLivePath(view.tappa.id, view.categoria)}
            className={buttonVariants({
              variant: "primary",
              className: "max-w-full",
            })}
          >
            Vai alla gestione live
            <ArrowRightIcon aria-hidden />
          </Link>
        </div>
      );
      break;
    case "pronta":
      corpo = (
        <div className="flex flex-col gap-stack-sm">
          <p>
            {view.tipo === "gold_silver"
              ? "Dalle classifiche dei gironi iniziali: 1° e 2° di ogni girone vanno nei gironi gold, 3° e 4° nei silver. Dopo la proposta li controlli e li modifichi qui sotto, prima dell'avvio."
              : "Dalle classifiche dei gironi gold e silver: i migliori di ogni girone giocano la finale del loro colore."}
          </p>
          {view.avvisi.length > 0 ? (
            <ul
              className="flex flex-col gap-space-1 border-l-4 border-warning-fg bg-warning-bg p-inset text-warning-fg"
              data-testid="prossima-fase-avvisi"
            >
              {view.avvisi.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : null}
          <ul
            aria-label={
              view.tipo === "gold_silver"
                ? "Gironi proposti"
                : "Finali proposte"
            }
            className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-stack"
          >
            {view.anteprima.map((g) => (
              <GironeAnteprima key={`${g.fase}-${g.nome}`} girone={g} />
            ))}
          </ul>
          <AlertDialog
            open={open}
            onOpenChange={(next) => {
              if (!pending) setOpen(next);
            }}
          >
            <AlertDialogTrigger
              render={
                <Button
                  className="max-w-full self-start"
                  disabled={!online}
                  disabledReason={offlineReason}
                />
              }
            >
              {AZIONE[view.tipo]}
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-xl">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!online || pending) return;
                  const formData = new FormData(event.currentTarget);
                  startTransition(() => formAction(formData));
                }}
                className="contents"
              >
                <input type="hidden" name="tappaId" value={view.tappa.id} />
                <input
                  type="hidden"
                  name="categoria"
                  value={CATEGORIA_SEGMENTO[view.categoria]}
                />
                <input type="hidden" name="tipo" value={view.tipo} />
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {view.tipo === "gold_silver"
                      ? `Proporre i gironi gold e silver del ${tabellone}?`
                      : `Generare le finali del ${tabellone}?`}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {view.tipo === "gold_silver"
                      ? `Si creano ${view.anteprima.length} gironi, ancora da avviare: potrai spostare i giocatori nell'editor prima dell'avvio.`
                      : "Si creano la finale gold e la finale silver con le loro partite da giocare; il tabellone passa a «Finali» e le pagine live lo mostrano."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction
                    type="submit"
                    loading={pending}
                    loadingText="Salvataggio…"
                  >
                    {view.tipo === "gold_silver" ? "Proponi" : "Genera"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </form>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      );
      break;
  }

  return (
    <section
      aria-labelledby={titoloId}
      className="flex flex-col gap-stack-sm border-l-4 border-tape ps-inset"
      data-testid={`prossima-fase-${view.tipo}`}
      data-stato={view.stato}
    >
      <h2 id={titoloId} className="font-heading text-xl font-semibold">
        {TITOLO[view.tipo]}
      </h2>
      <FaseTabellone view={view} />
      <div role="alert">
        {errore ? (
          <div className="flex flex-col items-start gap-space-2 border-2 border-error-fg bg-error-bg p-inset text-error-fg">
            <p className="flex items-start gap-space-2 font-semibold">
              <AlertCircleIcon aria-hidden className="mt-1 size-4 shrink-0" />
              {errore.message}
            </p>
            {errore.reason === "sessionExpired" ? (
              <Link
                href={sessionExpiredHref(
                  view.tipo === "gold_silver"
                    ? gironiPath(view.tappa.id, view.categoria)
                    : avvioFasePath(view.tappa.id, view.categoria),
                )}
                className={buttonVariants({ variant: "primary" })}
              >
                Accedi di nuovo
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
      {corpo}
    </section>
  );
}
