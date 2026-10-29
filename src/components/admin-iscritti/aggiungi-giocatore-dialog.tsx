"use client";

import {
  AlertCircleIcon,
  Loader2Icon,
  SearchIcon,
  UserPlusIcon,
} from "lucide-react";
import Link from "next/link";
import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { Categoria } from "@/lib/db/types";
import { nomeCompleto, risultatiTesto } from "@/lib/iscrizioni/admin/format";
import {
  ISCRITTI_MESSAGES,
  RICERCA_MIN_CARATTERI,
} from "@/lib/iscrizioni/admin/messages";
import { iscrittiPath } from "@/lib/iscrizioni/admin/paths";
import { paroleRicerca } from "@/lib/iscrizioni/admin/search";
import {
  initialModificaIscrittiState,
  type CercaGiocatoriAction,
  type CercaGiocatoriEsito,
  type GiocatoreTrovato,
  type IscrittiTabelloneView,
  type ModificaIscrittiAction,
  type ModificaIscrittiState,
} from "@/lib/iscrizioni/admin/types";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";
import { CATEGORIA_TABELLONE } from "@/lib/tappe/gestione-format";

/** Pause after the last keystroke before the search runs. */
export const RICERCA_DEBOUNCE_MS = 300;

export type Ricerca =
  | { stato: "vuota" }
  | { stato: "corta" }
  | { stato: "inCorso" }
  | { stato: "esito"; esito: CercaGiocatoriEsito };

type AggiungiGiocatoreDialogProps = {
  tappaId: string;
  tabelloni: readonly IscrittiTabelloneView[];
  /** The `cercaGiocatori` server action (a fake in Storybook). */
  cerca: CercaGiocatoriAction;
  /** The `aggiungiIscritto` server action (a fake in Storybook). */
  action: ModificaIscrittiAction;
  /** Storybook: open on mount, with a query and its result. */
  defaultOpen?: boolean;
  initialQuery?: string;
  initialRicerca?: Ricerca;
  initialState?: ModificaIscrittiState;
  /** «secondary» while another action of the page is the primary one. */
  triggerVariant?: "primary" | "secondary";
};

/** Why a found player cannot be added, or null. */
function motivoBlocco(
  giocatore: GiocatoreTrovato,
  pieni: ReadonlySet<Categoria>,
): string | null {
  if (giocatore.iscritto) return "Già iscritto a questa tappa.";
  if (!giocatore.categoria) return "Non ha ancora scelto la categoria.";
  if (pieni.has(giocatore.categoria))
    return `Tabellone ${CATEGORIA_TABELLONE[giocatore.categoria].toLowerCase()} al completo.`;
  return null;
}

function testoStato(ricerca: Ricerca): string {
  switch (ricerca.stato) {
    case "vuota":
      return "";
    case "corta":
      return `Scrivi almeno ${RICERCA_MIN_CARATTERI} caratteri.`;
    case "inCorso":
      return "Ricerca in corso…";
    case "esito":
      return ricerca.esito.status === "ok"
        ? risultatiTesto(ricerca.esito.giocatori.length)
        : ricerca.esito.message;
  }
}

function Risultato({
  giocatore,
  blocco,
  pending,
  scelto,
  onAggiungi,
}: {
  giocatore: GiocatoreTrovato;
  blocco: string | null;
  pending: boolean;
  scelto: boolean;
  onAggiungi: () => void;
}) {
  const motivoId = useId();
  const nome = nomeCompleto(giocatore);
  return (
    <li
      data-giocatore={giocatore.id}
      className="flex flex-wrap items-center justify-between gap-x-space-4 gap-y-space-2 border-b border-border py-space-3 last:border-b-0"
    >
      <div className="flex min-w-0 flex-1 basis-48 flex-col [overflow-wrap:anywhere]">
        <span className="font-heading font-semibold">{nome}</span>
        <span className="text-sm text-muted-foreground">{giocatore.email}</span>
        <span className="text-sm">
          {giocatore.categoria
            ? CATEGORIA_TABELLONE[giocatore.categoria]
            : "Categoria non scelta"}
        </span>
        {blocco ? (
          <span id={motivoId} className="text-sm font-medium">
            {blocco}
          </span>
        ) : null}
      </div>
      <Button
        variant="primary"
        className="max-w-full"
        aria-label={`Aggiungi ${nome}`}
        disabled={blocco !== null}
        focusableWhenDisabled
        aria-describedby={blocco ? motivoId : undefined}
        loading={pending && scelto}
        onClick={onAggiungi}
      >
        <UserPlusIcon aria-hidden className="size-4" />
        Aggiungi
      </Button>
    </li>
  );
}

/**
 * w-admin-aggiungi-giocatore: search a registered player by name, surname
 * or email and register them on the board of their category, also with
 * registrations closed. The number of results is announced in a status
 * region that stays mounted; each result that cannot be added says why.
 * The server still checks the maximum and duplicates in one transaction.
 */
export function AggiungiGiocatoreDialog({
  tappaId,
  tabelloni,
  cerca,
  action,
  defaultOpen = false,
  initialQuery = "",
  initialRicerca = { stato: "vuota" },
  initialState = initialModificaIscrittiState,
  triggerVariant = "primary",
}: AggiungiGiocatoreDialogProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState(initialQuery);
  const [ricerca, setRicerca] = useState<Ricerca>(initialRicerca);
  const [scelto, setScelto] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const richiesta = useRef(0);
  const toast = useToast();
  const statoId = useId();

  const safeAction = useCallback<ModificaIscrittiAction>(
    async (prev, formData) => {
      try {
        return await action(prev, formData);
      } catch (error) {
        console.error("[iscritti] richiesta non riuscita", error);
        return {
          status: "error",
          reason: "network",
          message: ISCRITTI_MESSAGES.network,
          at: prev.status === "idle" ? 1 : prev.at + 1,
        };
      }
    },
    [action],
  );
  const [state, formAction, pending] = useActionState(safeAction, initialState);

  // A new result: close after a success (adjusting state during render).
  // Base UI gives focus back to «Aggiungi giocatore».
  const [visto, setVisto] = useState(state);
  const [mostraErrore, setMostraErrore] = useState(
    initialState.status === "error",
  );
  if (state !== visto) {
    setVisto(state);
    if (state.status === "success") setOpen(false);
    if (state.status === "error") setMostraErrore(true);
  }

  useEffect(() => {
    if (state.status === "success") toast.add({ title: state.message });
  }, [state, toast]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const esegui = useCallback(
    (valore: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      const id = ++richiesta.current;
      cerca(tappaId, valore)
        .catch((): CercaGiocatoriEsito => ({
          status: "error",
          message: ISCRITTI_MESSAGES.ricercaNonRiuscita,
        }))
        .then((esito) => {
          // Only the latest query counts: a slow answer never overwrites it.
          if (id === richiesta.current) setRicerca({ stato: "esito", esito });
        });
    },
    [cerca, tappaId],
  );

  function onQuery(valore: string) {
    setQuery(valore);
    setMostraErrore(false);
    if (timer.current) clearTimeout(timer.current);
    richiesta.current += 1;
    if (valore.trim() === "") {
      setRicerca({ stato: "vuota" });
      return;
    }
    if (paroleRicerca(valore).length === 0) {
      // Announced only after the pause, like the results.
      timer.current = setTimeout(
        () => setRicerca({ stato: "corta" }),
        RICERCA_DEBOUNCE_MS,
      );
      return;
    }
    setRicerca({ stato: "inCorso" });
    timer.current = setTimeout(() => esegui(valore), RICERCA_DEBOUNCE_MS);
  }

  function aggiungi(giocatore: GiocatoreTrovato) {
    if (pending) return;
    setScelto(giocatore.id);
    const formData = new FormData();
    formData.set("tappaId", tappaId);
    formData.set("utenteId", giocatore.id);
    startTransition(() => formAction(formData));
  }

  const pieni = new Set(
    tabelloni.filter((t) => t.pieno).map((t) => t.categoria),
  );
  const tuttiPieni = tabelloni.length > 0 && pieni.size === tabelloni.length;
  const errore = state.status === "error" && mostraErrore ? state : null;
  const giocatori =
    ricerca.stato === "esito" && ricerca.esito.status === "ok"
      ? ricerca.esito.giocatori
      : [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (next) {
          // Every opening starts from an empty search.
          richiesta.current += 1;
          setQuery(initialQuery);
          setRicerca(initialRicerca);
          setMostraErrore(false);
        }
        setOpen(next);
      }}
    >
      <DialogTrigger
        render={<Button variant={triggerVariant} className="max-w-full" />}
      >
        <UserPlusIcon aria-hidden className="size-4" />
        Aggiungi giocatore
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Aggiungi giocatore</DialogTitle>
          <DialogDescription>
            Cerca un giocatore registrato: va nel tabellone della sua categoria,
            al primo posto libero, anche a iscrizioni chiuse.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-stack-sm">
          {tuttiPieni ? (
            <p className="flex items-start gap-space-2 border-2 border-warning-fg bg-warning-bg p-inset font-medium text-warning-fg">
              <AlertCircleIcon aria-hidden className="mt-1 size-4 shrink-0" />
              Entrambi i tabelloni sono al completo: rimuovi un iscritto per
              liberare un posto.
            </p>
          ) : null}
          <Field
            label="Cerca per nome, cognome o email"
            hint={`Almeno ${RICERCA_MIN_CARATTERI} caratteri. Invio per cercare subito.`}
          >
            <Input
              type="search"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onValueChange={(valore) => onQuery(valore)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                if (paroleRicerca(query).length === 0) {
                  if (timer.current) clearTimeout(timer.current);
                  setRicerca(
                    query.trim() ? { stato: "corta" } : { stato: "vuota" },
                  );
                  return;
                }
                setRicerca({ stato: "inCorso" });
                esegui(query);
              }}
            />
          </Field>
          <p
            id={statoId}
            role="status"
            data-testid="ricerca-stato"
            className="flex min-h-6 items-center gap-space-2 font-medium"
          >
            {ricerca.stato === "inCorso" ? (
              <Loader2Icon
                aria-hidden
                className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
              />
            ) : (
              <SearchIcon aria-hidden className="size-4 shrink-0" />
            )}
            {testoStato(ricerca)}
          </p>
          {giocatori.length > 0 ? (
            <ul aria-label="Giocatori trovati" className="flex flex-col">
              {giocatori.map((giocatore) => (
                <Risultato
                  key={giocatore.id}
                  giocatore={giocatore}
                  blocco={motivoBlocco(giocatore, pieni)}
                  pending={pending}
                  scelto={scelto === giocatore.id}
                  onAggiungi={() => aggiungi(giocatore)}
                />
              ))}
            </ul>
          ) : null}
          {errore ? (
            <div
              role="alert"
              className="flex flex-col items-start gap-space-2 border-2 border-error-fg bg-error-bg p-inset text-error-fg"
            >
              <p className="flex items-start gap-space-2 font-semibold">
                <AlertCircleIcon aria-hidden className="mt-1 size-4 shrink-0" />
                {errore.message}
              </p>
              {errore.reason === "sessionExpired" ? (
                <Link
                  href={sessionExpiredHref(iscrittiPath(tappaId))}
                  className={buttonVariants({ variant: "primary" })}
                >
                  Accedi di nuovo
                </Link>
              ) : null}
            </div>
          ) : null}
        </DialogBody>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
