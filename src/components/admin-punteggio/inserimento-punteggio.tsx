"use client";

import { AlertCircleIcon, ArrowLeftIcon, CheckIcon } from "lucide-react";
import Link from "next/link";
import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { focusFirstInvalid } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useOnline } from "@/hooks/use-online";
import { useFormDraft } from "@/lib/drafts/use-form-draft";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";
import {
  coppie,
  descriviPartita,
  descriviRisultato,
  setPartita,
} from "@/lib/punteggi/format";
import {
  annuncioCosaCambia,
  cosaCambia,
} from "@/lib/punteggi/correzione/cosa-cambia";
import { esitoScelta } from "@/lib/punteggi/correzione/format";
import type { SceltaImpatto } from "@/lib/punteggi/correzione/types";
import { punteggiPath, punteggioPath } from "@/lib/punteggi/paths";
import { DURATA_ANNULLA_MS, spiegaRegolaSet } from "@/lib/punteggi/regola";
import {
  initialPunteggioState,
  PUNTEGGIO_MESSAGES,
  type AnnullaPunteggioAction,
  type PunteggioState,
  type SalvaPunteggioAction,
} from "@/lib/punteggi/state";
import type { SetPunteggio } from "@/lib/db/types";
import type { SchedaPunteggio } from "@/lib/punteggi/types";
import { validaPunteggio, type Lato } from "@/lib/punteggi/validazione";
import { ConflittoPunteggio } from "./conflitto-punteggio";
import { CosaCambia } from "./cosa-cambia";
import { ImpattoFase } from "./impatto-fase";
import { RiepilogoPunteggio } from "./riepilogo-punteggio";
import { RigaSquadra } from "./riga-squadra";

/** Inline checks wait for a typing pause (see BLVS-21's blur gotcha). */
export const VERIFICA_DOPO_MS = 600;

export type Passo = "inserimento" | "riepilogo";

type InserimentoPunteggioProps = {
  scheda: SchedaPunteggio;
  /** The `salvaPunteggio` server action (a fake in Storybook). */
  salva: SalvaPunteggioAction;
  /** The `annullaPunteggio` server action (a fake in Storybook). */
  annulla: AnnullaPunteggioAction;
  /** Storybook/tests: starting values, step, state, forced offline. */
  initialValori?: Record<Lato, string>;
  initialPasso?: Passo;
  initialState?: PunteggioState;
  /** Storybook: show the inline checks at once. */
  verificaIniziale?: boolean;
  offline?: boolean;
};

function focusOn(el: HTMLElement | null) {
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView?.({ block: "nearest" });
}

function valoriDa(scheda: SchedaPunteggio): Record<Lato, string> {
  const set = setPartita(scheda.partita.sets);
  return set ? { a: String(set.a), b: String(set.b) } : { a: "", b: "" };
}

/**
 * w-admin-punteggio and w-admin-punteggio-riepilogo: the two pairs with a
 * numeric field and −/+ each, checked as you type (after a pause) with
 * the same rules as the server; then a summary with «Conferma e salva».
 * After the save a toast offers «Annulla» for 10 s (paused on hover or
 * focus); the score, the group standing and the live pages follow.
 */
export function InserimentoPunteggio({
  scheda,
  salva,
  annulla,
  initialValori,
  initialPasso = "inserimento",
  initialState = initialPunteggioState,
  verificaIniziale = false,
  offline: forceOffline,
}: InserimentoPunteggioProps) {
  const { tappa, partita } = scheda;
  const nomi = coppie(partita);
  const online = useOnline(
    forceOffline === undefined ? undefined : !forceOffline,
  );
  const toast = useToast();
  const ids = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const riepilogoRef = useRef<HTMLHeadingElement>(null);
  const esitoRef = useRef<HTMLParagraphElement>(null);
  const erroreRef = useRef<HTMLDivElement>(null);

  const [passo, setPasso] = useState<Passo>(initialPasso);
  const [valori, setValori] = useState(() => initialValori ?? valoriDa(scheda));
  // Inline checks show after a pause, or at once after «Vai al riepilogo».
  const [verifica, setVerifica] = useState(verificaIniziale);
  const [tentato, setTentato] = useState(verificaIniziale);
  const [annuncio, setAnnuncio] = useState("");
  const [esitoAnnulla, setEsitoAnnulla] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [annullando, startAnnulla] = useTransition();
  /** The match's score when «Conferma e salva» was pressed. */
  const valoriPrima = useRef(valoriDa(scheda));

  const percorso = punteggioPath(tappa.id, partita.id);
  const { restoredAt, clear } = useFormDraft(formRef, {
    id: `punteggio-${partita.id}-v${partita.versione}`,
    label: `Punteggio: ${nomi.a} contro ${nomi.b}`,
    path: percorso,
  });
  // The draft is written straight into the DOM: read it back into state.
  useEffect(() => {
    if (!restoredAt || !formRef.current) return;
    const data = new FormData(formRef.current);
    setValori({
      a: String(data.get("puntiA") ?? ""),
      b: String(data.get("puntiB") ?? ""),
    });
  }, [restoredAt]);

  useEffect(() => {
    if (verifica) return;
    const timer = setTimeout(() => setVerifica(true), VERIFICA_DOPO_MS);
    return () => clearTimeout(timer);
  }, [valori, verifica]);

  const cambia = (lato: Lato, value: string) => {
    setValori((v) => ({ ...v, [lato]: value }));
    setVerifica(false);
    setEsitoAnnulla(null);
    setEsitoTieni(null);
  };

  const safeSalva = useCallback<SalvaPunteggioAction>(
    async (prev, formData) => {
      try {
        return await salva(prev, formData);
      } catch (error) {
        console.error("[punteggi] richiesta non riuscita", error);
        return {
          status: "error",
          reason: "network",
          message: PUNTEGGIO_MESSAGES.network,
          at: prev.status === "idle" ? 1 : prev.at + 1,
        };
      }
    },
    [salva],
  );
  const [state, formAction, pending] = useActionState(safeSalva, initialState);

  // The version the admin's values are based on: the page's, then the one
  // of their own save, undo or «Tieni il salvato». It never follows a
  // refreshed page by itself, so another admin's save always ends in the
  // conflict dialog instead of being overwritten silently (BLVS-34).
  const [versione, setUltimaVersione] = useState(partita.versione);

  // BLVS-34: the last conflict (kept while the dialog fades out) and the
  // official sets the admin chose to keep, until the page catches up.
  const [conflitto, setConflitto] = useState<Extract<
    PunteggioState,
    { status: "conflict" }
  > | null>(null);
  const [conflittoAperto, setConflittoAperto] = useState(false);
  const [setsTenuti, setSetsTenuti] = useState<SetPunteggio[] | null>(null);
  const [esitoTieni, setEsitoTieni] = useState<string | null>(null);
  /** A choice was made in the dialog: focus then goes to the outcome. */
  const sceltaFatta = useRef(false);

  // BLVS-41: the next phase already exists. The last request is kept so
  // «Mantieni»/«Rigenera» send the same values (and version) again.
  const [impatto, setImpatto] = useState<Extract<
    PunteggioState,
    { status: "impatto" }
  > | null>(null);
  const [impattoAperto, setImpattoAperto] = useState(false);
  const [sceltaInCorso, setSceltaInCorso] = useState<SceltaImpatto | null>(
    null,
  );
  const ultimoInvio = useRef<FormData | null>(null);

  const [visto, setVisto] = useState(state);
  if (state !== visto) {
    setVisto(state);
    if (state.status === "fieldErrors") {
      setPasso("inserimento");
      setTentato(true);
      setVerifica(true);
      setAnnuncio(
        [state.message, ...Object.values(state.campi), state.punteggio]
          .filter(Boolean)
          .join(" "),
      );
    }
    if (state.status === "success") {
      setUltimaVersione(state.versione);
      setPasso("inserimento");
      setAnnuncio("");
      setEsitoAnnulla(null);
      setConflittoAperto(false);
      setSetsTenuti(null);
      setEsitoTieni(null);
      setImpattoAperto(false);
    }
    if (state.status === "conflict") {
      setConflitto(state);
      setConflittoAperto(true);
      setImpattoAperto(false);
      setAnnuncio("");
    }
    if (state.status === "impatto") {
      setImpatto(state);
      setImpattoAperto(true);
      setAnnuncio("");
    }
    if (state.status === "fieldErrors") setImpattoAperto(false);
    // A failed request from the impact dialog stays inside it.
    if (state.status === "error") setConflittoAperto(false);
  }

  const doAnnulla = useCallback(
    (salvato: Extract<PunteggioState, { status: "success" }>) => {
      startAnnulla(async () => {
        let esito;
        try {
          esito = await annulla({
            tappaId: tappa.id,
            partitaId: partita.id,
            versione: salvato.versione,
          });
        } catch (error) {
          console.error("[punteggi] annullamento non riuscito", error);
          esito = {
            status: "error" as const,
            message: PUNTEGGIO_MESSAGES.networkAnnulla,
          };
        }
        if (esito.status === "success") {
          setUltimaVersione(salvato.versione + 1);
          // The fields go back to the score the match had before the save.
          setValori(valoriPrima.current);
        }
        setEsitoAnnulla({
          ok: esito.status === "success",
          message: esito.message,
        });
        toast.add({ title: esito.message });
      });
    },
    [annulla, partita.id, tappa.id, toast],
  );

  // After a save: the toast with «Annulla», the draft cleared, focus on the
  // confirmation (kept mounted so focus never falls to <body>).
  useEffect(() => {
    if (state.status === "fieldErrors") {
      requestAnimationFrame(() => {
        if (formRef.current) focusFirstInvalid(formRef.current);
      });
    }
    if (state.status === "error" && !impattoAperto) {
      focusOn(erroreRef.current);
    }
    if (state.status === "success") {
      clear();
      toast.add({
        title: state.message,
        description: descriviRisultato(partita, state.punteggio),
        timeout: DURATA_ANNULLA_MS,
        actionProps: {
          children: "Annulla",
          "aria-label": `Annulla il salvataggio di ${descriviRisultato(partita, state.punteggio)}`,
          onClick: () => doAnnulla(state),
        },
      });
      focusOn(esitoRef.current);
    }
    // Only a new action state triggers this; `partita` follows refresh().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    if (esitoAnnulla) focusOn(esitoRef.current);
  }, [esitoAnnulla]);

  const controllo = validaPunteggio(valori, { completo: tentato });
  const mostra = verifica || tentato;
  const campi = mostra ? controllo.campi : {};
  const erroreServer =
    state.status === "fieldErrors" && !verifica ? state.punteggio : null;
  const punteggioErrore = mostra ? controllo.punteggio : erroreServer;
  const esiti = mostra
    ? controllo.esiti
    : ({ a: "vuoto", b: "vuoto" } as const);
  const punteggioErroreId = `${ids}-errore-punteggio`;

  const alRiepilogo = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const completo = validaPunteggio(valori);
    setTentato(true);
    setVerifica(true);
    if (!completo.valido) {
      setAnnuncio(
        [
          PUNTEGGIO_MESSAGES.fieldErrors,
          ...Object.values(completo.campi),
          completo.punteggio,
        ]
          .filter(Boolean)
          .join(" "),
      );
      requestAnimationFrame(() => {
        if (formRef.current) focusFirstInvalid(formRef.current);
      });
      return;
    }
    setAnnuncio("");
    setPasso("riepilogo");
    requestAnimationFrame(() => focusOn(riepilogoRef.current));
  };

  const conferma = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!online || pending) return;
    const data = new FormData(event.currentTarget);
    valoriPrima.current = valoriDa(scheda);
    sceltaFatta.current = false;
    ultimoInvio.current = data;
    setSceltaInCorso(null);
    startTransition(() => formAction(data));
  };

  /** «Mantieni» / «Rigenera»: the same request, with the choice. */
  const scegli = (scelta: SceltaImpatto, spuntata: boolean) => {
    if (!impatto || !ultimoInvio.current || !online || pending) return;
    const data = new FormData();
    for (const [k, v] of ultimoInvio.current.entries()) data.set(k, v);
    data.set("versione", String(impatto.versione));
    data.set("puntiA", String(impatto.mio.a));
    data.set("puntiB", String(impatto.mio.b));
    data.set("scelta", scelta);
    data.set("conferma", spuntata ? "on" : "");
    data.set("attesi", String(impatto.impatto.punteggiPersi));
    sceltaFatta.current = true;
    setSceltaInCorso(scelta);
    startTransition(() => formAction(data));
  };

  /** «Tieni il salvato»: the form takes the official score and version. */
  const tieniSalvato = () => {
    if (!conflitto) return;
    const { salvato } = conflitto;
    const set = setPartita(salvato.sets);
    sceltaFatta.current = true;
    clear();
    setUltimaVersione(salvato.versione);
    setSetsTenuti(salvato.sets);
    setValori(set ? { a: String(set.a), b: String(set.b) } : { a: "", b: "" });
    setPasso("inserimento");
    setEsitoAnnulla(null);
    setEsitoTieni(
      `${PUNTEGGIO_MESSAGES.tenuto}: ${set ? descriviRisultato(partita, set) : "nessun punteggio"}.`,
    );
  };

  /** «Sì, sovrascrivi»: saves again, only over the version shown. */
  const sovrascrivi = (versioneVista: number) => {
    if (!conflitto || !online || pending) return;
    sceltaFatta.current = true;
    const data = new FormData();
    data.set("tappaId", tappa.id);
    data.set("partitaId", partita.id);
    data.set("versione", String(versioneVista));
    data.set("puntiA", String(conflitto.mio.a));
    data.set("puntiB", String(conflitto.mio.b));
    data.set("sovrascrivi", "1");
    const ufficiale = setPartita(conflitto.salvato.sets);
    valoriPrima.current = ufficiale
      ? { a: String(ufficiale.a), b: String(ufficiale.b) }
      : { a: "", b: "" };
    ultimoInvio.current = data;
    setSceltaInCorso(null);
    startTransition(() => formAction(data));
  };

  const salvato = state.status === "success" ? state : null;
  const errore = state.status === "error" ? state : null;
  const giocabile = tappa.stato === "in_corso" && partita.stato !== "annullata";
  // The score the admin knows to be saved: the page's, or the one kept in
  // the conflict dialog while the page still shows the older one.
  const nota =
    setsTenuti && versione > partita.versione
      ? { ...partita, sets: setsTenuti, stato: "conclusa" as const }
      : partita;
  const correzione = nota.stato === "conclusa" && nota.sets.length > 0;
  const attuale = setPartita(nota.sets);
  // «Cosa cambia» follows the values; it is announced after a pause.
  const girone = (scheda.girone ?? [partita]).map((p) =>
    p.id === nota.id ? nota : p,
  );
  const cambio = correzione
    ? cosaCambia(nota, girone, validaPunteggio(valori))
    : null;
  const esitoImpatto = salvato
    ? esitoScelta(salvato.scelta, salvato.punteggiPersi ?? 0)
    : null;

  return (
    <div
      className="flex flex-col gap-stack-lg"
      data-testid="inserimento-punteggio"
    >
      <section
        aria-labelledby={`${ids}-partita`}
        className="flex flex-col gap-space-2"
      >
        <p className="font-heading font-semibold">{tappa.nome}</p>
        <h2
          id={`${ids}-partita`}
          className="font-heading text-2xl font-semibold text-balance [overflow-wrap:anywhere]"
        >
          {nomi.a} <span className="font-normal">contro</span> {nomi.b}
        </h2>
        <p>{descriviPartita(partita)}</p>
        {attuale ? (
          <p data-testid="punteggio-attuale">
            Punteggio salvato:{" "}
            <span className="font-mono font-bold tabular-nums">
              {attuale.a}–{attuale.b}
            </span>
          </p>
        ) : null}
        <Link
          href={punteggiPath(tappa.id)}
          className={buttonVariants({
            variant: "link",
            className: "self-start",
          })}
        >
          <ArrowLeftIcon aria-hidden className="size-4" />
          Tutte le partite della tappa
        </Link>
      </section>

      <div
        aria-live="polite"
        aria-atomic="true"
        data-testid="annuncio-punteggio"
        className="sr-only"
      >
        {annuncio}
      </div>

      {esitoAnnulla || salvato || esitoTieni ? (
        <p
          ref={esitoRef}
          tabIndex={-1}
          data-testid="esito-punteggio"
          className="flex items-start gap-space-2 self-start border-s-8 border-primary bg-tape p-inset font-heading text-lg font-semibold text-primary focus-ring"
        >
          {esitoAnnulla && !esitoAnnulla.ok ? (
            <AlertCircleIcon aria-hidden className="mt-1 size-5 shrink-0" />
          ) : (
            <CheckIcon aria-hidden className="mt-1 size-5 shrink-0" />
          )}
          <span>
            {esitoTieni
              ? esitoTieni
              : esitoAnnulla
                ? esitoAnnulla.message
                : salvato
                  ? [
                      `${salvato.message}: ${descriviRisultato(partita, salvato.punteggio)}.`,
                      esitoImpatto,
                    ]
                      .filter(Boolean)
                      .join(" ")
                  : null}
          </span>
        </p>
      ) : null}

      {errore ? (
        <div
          ref={erroreRef}
          tabIndex={-1}
          role="alert"
          data-testid="errore-punteggio"
          className="flex flex-col items-start gap-space-2 border-2 border-error-fg bg-error-bg p-inset text-error-fg focus-ring"
        >
          <p className="flex items-start gap-space-2 font-semibold">
            <AlertCircleIcon aria-hidden className="mt-1 size-4 shrink-0" />
            {errore.message}
          </p>
          {errore.reason === "sessionExpired" ? (
            <Link
              href={sessionExpiredHref(percorso)}
              className={buttonVariants({ variant: "primary" })}
            >
              Accedi di nuovo
            </Link>
          ) : errore.reason === "conflict" ? (
            <Link
              href={percorso}
              className={buttonVariants({ variant: "secondary" })}
            >
              Ricarica il punteggio
            </Link>
          ) : null}
        </div>
      ) : null}

      {!giocabile ? (
        <p className="font-semibold">{PUNTEGGIO_MESSAGES.nonGiocabile}</p>
      ) : null}

      <form
        ref={formRef}
        noValidate
        hidden={passo !== "inserimento" || !giocabile}
        onSubmit={alRiepilogo}
        aria-labelledby={`${ids}-titolo-form`}
        className="flex flex-col gap-stack-sm"
      >
        <div className="flex flex-col gap-space-1">
          <h2
            id={`${ids}-titolo-form`}
            className="font-heading text-xl font-semibold"
          >
            {correzione ? "Correggi il punteggio" : "Inserisci il punteggio"}
          </h2>
          <p id={`${ids}-regola`}>{spiegaRegolaSet()}</p>
        </div>
        {(["a", "b"] as const).map((lato) => (
          <RigaSquadra
            key={lato}
            id={`${ids}-punti-${lato}`}
            name={lato === "a" ? "puntiA" : "puntiB"}
            coppia={nomi[lato]}
            giocatori={partita.squadre[lato]}
            value={valori[lato]}
            onChange={(value) => cambia(lato, value)}
            esito={esiti[lato]}
            error={campi[lato]}
            punteggioInvalido={punteggioErrore != null}
            punteggioErroreId={punteggioErroreId}
            esitoId={`${ids}-esito-${lato}`}
            disabled={pending}
          />
        ))}
        <p
          id={punteggioErroreId}
          data-testid="errore-set"
          className="flex min-h-6 items-start gap-space-2 font-semibold text-error-fg"
        >
          {punteggioErrore ? (
            <>
              <AlertCircleIcon aria-hidden className="mt-1 size-4 shrink-0" />
              <span>
                <span className="sr-only">Errore:</span> {punteggioErrore}
              </span>
            </>
          ) : null}
        </p>
        {cambio ? (
          <CosaCambia
            id={`${ids}-cosa-cambia`}
            cambio={cambio}
            vecchio={attuale}
            nuovo={controllo.punti}
            annuncio={
              verifica && passo === "inserimento"
                ? annuncioCosaCambia(cambio)
                : ""
            }
          />
        ) : null}
        <Button type="submit" size="campo" className="max-w-full self-start">
          Vai al riepilogo
        </Button>
      </form>

      {passo === "riepilogo" && giocabile ? (
        <RiepilogoPunteggio
          partita={nota}
          valori={controllo.punti}
          vincitore={controllo.vincitore}
          correzione={correzione}
          cambio={cambio}
          headingRef={riepilogoRef}
          versione={versione}
          tappaId={tappa.id}
          pending={pending}
          online={online}
          onSubmit={conferma}
          onModifica={() => {
            setPasso("inserimento");
            requestAnimationFrame(() =>
              focusOn(document.getElementById(`${ids}-punti-a`)),
            );
          }}
        />
      ) : null}

      {conflitto ? (
        <ConflittoPunteggio
          open={conflittoAperto}
          onOpenChange={setConflittoAperto}
          salvato={conflitto.salvato}
          mio={[conflitto.mio]}
          coppie={nomi}
          pending={pending}
          onTieniSalvato={tieniSalvato}
          onSovrascrivi={sovrascrivi}
          // After a choice focus goes to its outcome; after Esc back to
          // «Conferma e salva», with the admin's values still there.
          finalFocus={() =>
            sceltaFatta.current
              ? (esitoRef.current ?? erroreRef.current ?? true)
              : true
          }
        />
      ) : null}

      {impatto ? (
        <ImpattoFase
          open={impattoAperto}
          onOpenChange={setImpattoAperto}
          impatto={impatto.impatto}
          erroreConferma={
            state.status === "impatto" ? state.erroreConferma : null
          }
          avviso={state.status === "impatto" ? state.avviso : null}
          errore={state.status === "error" ? state.message : null}
          pending={pending}
          online={online}
          inCorso={sceltaInCorso}
          onScegli={scegli}
          // After a choice focus goes to its outcome; after «Annulla» or
          // Esc back to «Conferma e salva», with the values kept.
          finalFocus={() =>
            sceltaFatta.current
              ? (esitoRef.current ?? erroreRef.current ?? true)
              : true
          }
        />
      ) : null}

      {annullando ? (
        <p role="status" className="font-semibold">
          Annullamento in corso…
        </p>
      ) : null}
    </div>
  );
}
