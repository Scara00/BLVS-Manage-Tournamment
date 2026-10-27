"use client";

import { AlertCircleIcon, SendIcon } from "lucide-react";
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
import { focusFirstInvalid } from "@/components/ui/field";
import { useOnline } from "@/hooks/use-online";
import { formatLiveTime } from "@/lib/live/format";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";
import {
  formatOraSalvataggio,
  type PunteggioUfficiale,
} from "@/lib/punteggi/conflitto/rileva";
import { coppie, descriviRisultato } from "@/lib/punteggi/format";
import {
  initialParzialeState,
  PARZIALE_MESSAGES,
  validaParziale,
  type ParzialeState,
  type SalvaParzialeAction,
} from "@/lib/punteggi/parziale";
import { punteggioPath } from "@/lib/punteggi/paths";
import type { SchedaPunteggio } from "@/lib/punteggi/types";
import type { Lato } from "@/lib/punteggi/validazione";
import { ConflittoPunteggio, type TestiConflitto } from "./conflitto-punteggio";
import { RigaSquadra } from "./riga-squadra";

/** The conflict dialog (BLVS-34) worded for a partial. */
const TESTI_PARZIALE: Partial<TestiConflitto> = {
  titolo: "Il parziale è cambiato",
  titoloConferma: "Sostituire il parziale inviato?",
  intro: (salvato: PunteggioUfficiale) => {
    const chi = salvato.autore
      ? `Un altro admin (${salvato.autore})`
      : "Un altro admin";
    const quando = formatOraSalvataggio(salvato.salvatoIl);
    return `${chi} ha inviato un parziale${quando ? ` ${quando}` : ""} mentre lo modificavi. Il tuo non è stato inviato: scegli quale tenere.`;
  },
  conferma: (salvato, mio) =>
    `Il parziale inviato ${salvato} viene sostituito dal tuo ${mio}. Il valore precedente resta nel registro.`,
  etichettaSalvato: "Inviato",
  badgeSalvato: "Più recente",
  tieni: "Tieni quello inviato",
};

type ParzialeFormProps = {
  scheda: SchedaPunteggio;
  /** The `salvaParziale` server action (a fake in Storybook). */
  invia: SalvaParzialeAction;
  /** Storybook/tests: starting values and state, forced offline. */
  initialValori?: Record<Lato, string>;
  initialState?: ParzialeState;
  offline?: boolean;
};

function valoriDa(scheda: SchedaPunteggio): Record<Lato, string> {
  const p = scheda.partita.parziale;
  return p ? { a: String(p.a), b: String(p.b) } : { a: "0", b: "0" };
}

/**
 * w-admin-punteggio, match in progress (BLVS-37, R-38): the admin sends the
 * running score to the players' w-live. It is NOT the result: it never
 * enters the standings and has its own version, so two admins sending at
 * once end in the conflict dialog instead of overwriting each other. Focus
 * stays on «Invia parziale» after a send; the outcome is a status message.
 */
export function ParzialeForm({
  scheda,
  invia,
  initialValori,
  initialState = initialParzialeState,
  offline: forceOffline,
}: ParzialeFormProps) {
  const { tappa, partita } = scheda;
  const nomi = coppie(partita);
  const online = useOnline(
    forceOffline === undefined ? undefined : !forceOffline,
  );
  const ids = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const erroreRef = useRef<HTMLDivElement>(null);
  const esitoRef = useRef<HTMLParagraphElement>(null);

  const [valori, setValori] = useState(() => initialValori ?? valoriDa(scheda));
  const [tentato, setTentato] = useState(false);
  // The partial's version the values are based on: it only follows the
  // admin's own send or «Tieni quello inviato», never a refreshed page.
  const [versione, setVersione] = useState(partita.parziale?.versione ?? 0);
  const [esitoTieni, setEsitoTieni] = useState<string | null>(null);

  const safeInvia = useCallback<SalvaParzialeAction>(
    async (prev, formData) => {
      try {
        return await invia(prev, formData);
      } catch (error) {
        console.error("[punteggi] invio del parziale non riuscito", error);
        return {
          status: "error",
          reason: "network",
          message: PARZIALE_MESSAGES.network,
          at: prev.status === "idle" ? 1 : prev.at + 1,
        };
      }
    },
    [invia],
  );
  const [state, formAction, pending] = useActionState(safeInvia, initialState);

  const [conflitto, setConflitto] = useState<Extract<
    ParzialeState,
    { status: "conflict" }
  > | null>(null);
  const [conflittoAperto, setConflittoAperto] = useState(false);
  const sceltaFatta = useRef(false);

  const [visto, setVisto] = useState(state);
  if (state !== visto) {
    setVisto(state);
    if (state.status === "success") {
      setVersione(state.versione);
      setTentato(false);
      setEsitoTieni(null);
      setConflittoAperto(false);
    }
    if (state.status === "fieldErrors") setTentato(true);
    if (state.status === "conflict") {
      setConflitto(state);
      setConflittoAperto(true);
      setEsitoTieni(null);
    }
    if (state.status === "error") setConflittoAperto(false);
  }

  useEffect(() => {
    if (state.status === "fieldErrors" && formRef.current) {
      focusFirstInvalid(formRef.current);
    }
    if (state.status === "error") erroreRef.current?.focus();
  }, [state]);

  const controllo = validaParziale(valori, { completo: tentato });
  const campi = tentato
    ? {
        ...controllo.campi,
        ...(state.status === "fieldErrors" ? state.campi : {}),
      }
    : {};

  const cambia = (lato: Lato, value: string) => {
    setValori((v) => ({ ...v, [lato]: value }));
    setEsitoTieni(null);
  };

  const invio = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!online || pending) return;
    const completo = validaParziale(valori);
    if (!completo.valido) {
      setTentato(true);
      requestAnimationFrame(() => {
        if (formRef.current) focusFirstInvalid(formRef.current);
      });
      return;
    }
    sceltaFatta.current = false;
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  };

  const tieni = () => {
    if (!conflitto) return;
    const set = conflitto.salvato.sets[0];
    sceltaFatta.current = true;
    setVersione(conflitto.salvato.versione);
    setValori(
      set ? { a: String(set.a), b: String(set.b) } : { a: "0", b: "0" },
    );
    setEsitoTieni(
      `${PARZIALE_MESSAGES.tenuto}: ${set ? descriviRisultato(partita, set) : "nessun parziale"}.`,
    );
  };

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
    startTransition(() => formAction(data));
  };

  const errore = state.status === "error" ? state : null;
  const inviato = state.status === "success" ? state : null;
  const esito = esitoTieni
    ? esitoTieni
    : inviato
      ? `${inviato.message}: ${descriviRisultato(partita, inviato.punti)}. ${PARZIALE_MESSAGES.fuoriClassifica}`
      : "";
  const attuale = partita.parziale;
  const percorso = punteggioPath(tappa.id, partita.id);

  return (
    <section
      aria-labelledby={`${ids}-titolo`}
      data-testid="parziale-form"
      className="flex flex-col gap-stack-sm border-2 border-primary p-inset"
    >
      <div className="flex flex-col gap-space-1">
        <div className="flex flex-wrap items-center gap-space-2">
          <h2
            id={`${ids}-titolo`}
            className="font-heading text-xl font-semibold"
          >
            Parziale
          </h2>
          <span className="bg-live-bg px-space-2 py-space-1 text-xs font-semibold tracking-wide text-live-fg uppercase">
            Partita in corso
          </span>
        </div>
        <p id={`${ids}-spiega`}>
          I giocatori lo vedono subito nel live.{" "}
          {PARZIALE_MESSAGES.fuoriClassifica}
        </p>
        <p data-testid="parziale-attuale">
          {attuale ? (
            <>
              Ultimo inviato:{" "}
              <span className="font-mono font-bold tabular-nums">
                {attuale.a}–{attuale.b}
              </span>{" "}
              alle {formatLiveTime(attuale.aggiornatoIl)}
            </>
          ) : (
            "Nessun parziale inviato finora."
          )}
        </p>
      </div>

      <form
        ref={formRef}
        noValidate
        onSubmit={invio}
        aria-describedby={`${ids}-spiega`}
        aria-labelledby={`${ids}-titolo`}
        className="flex flex-col gap-stack-sm"
      >
        <input type="hidden" name="tappaId" value={tappa.id} />
        <input type="hidden" name="partitaId" value={partita.id} />
        <input type="hidden" name="versione" value={versione} />
        {(["a", "b"] as const).map((lato) => (
          <RigaSquadra
            key={lato}
            parziale
            id={`${ids}-parziale-${lato}`}
            name={lato === "a" ? "puntiA" : "puntiB"}
            coppia={nomi[lato]}
            giocatori={partita.squadre[lato]}
            value={valori[lato]}
            onChange={(value) => cambia(lato, value)}
            esito={tentato ? controllo.esiti[lato] : "vuoto"}
            error={campi[lato]}
            punteggioInvalido={false}
            punteggioErroreId={`${ids}-parziale-errore`}
            esitoId={`${ids}-parziale-esito-${lato}`}
            disabled={pending}
          />
        ))}
        <div className="flex flex-wrap items-center gap-space-3">
          <Button
            type="submit"
            size="campo"
            className="max-w-full"
            disabled={!online}
            focusableWhenDisabled
            loading={pending}
          >
            <SendIcon aria-hidden />
            Invia parziale
          </Button>
          {!online ? (
            <p className="flex items-start gap-space-2 font-semibold">
              <AlertCircleIcon aria-hidden className="mt-1 size-4 shrink-0" />
              {PARZIALE_MESSAGES.offline}
            </p>
          ) : null}
        </div>
      </form>

      <p
        ref={esitoRef}
        role="status"
        tabIndex={-1}
        data-testid="esito-parziale"
        className={
          esito
            ? "self-start border-s-8 border-primary bg-tape p-inset font-semibold text-primary focus-ring"
            : "sr-only"
        }
      >
        {esito}
      </p>

      {errore ? (
        <div
          ref={erroreRef}
          tabIndex={-1}
          role="alert"
          data-testid="errore-parziale"
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
          ) : null}
        </div>
      ) : null}

      {conflitto ? (
        <ConflittoPunteggio
          open={conflittoAperto}
          onOpenChange={setConflittoAperto}
          salvato={conflitto.salvato}
          mio={[conflitto.mio]}
          coppie={nomi}
          pending={pending}
          onTieniSalvato={tieni}
          onSovrascrivi={sovrascrivi}
          testi={TESTI_PARZIALE}
          finalFocus={() =>
            sceltaFatta.current ? (esitoRef.current ?? true) : true
          }
        />
      ) : null}
    </section>
  );
}
