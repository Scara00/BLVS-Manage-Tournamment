"use client";

import {
  AlertCircleIcon,
  CloudOffIcon,
  LockIcon,
  RefreshCwIcon,
} from "lucide-react";
import Link from "next/link";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { UnsavedChangesGuard } from "@/components/profilo";
import { Tape } from "@/components/scoreboard";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, focusFirstInvalid } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { Categoria } from "@/lib/db/types";
import { useFormDraft } from "@/lib/drafts/use-form-draft";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";
import { POSTI_MAX, POSTI_MIN } from "@/lib/tappe/nuova/types";
import { riepilogoTappa } from "@/lib/tappe/modifica/format";
import {
  CAMPI_TAPPA_MODIFICA,
  CAMPO_POSTI_MODIFICA,
  TAPPA_MODIFICA_MESSAGES as M,
  initialTappaModificaFormState,
  tappaModificaPath,
  type CampoTappaModifica,
  type TappaModifica,
  type TappaModificaAction,
  type TappaModificaFieldErrors,
  type TappaModificaFormState,
} from "@/lib/tappe/modifica/types";
import {
  errorePosti,
  validaTappaModifica,
} from "@/lib/tappe/modifica/validation";
import { GironiPanel } from "./gironi-panel";

const TABELLONE = { M: "maschile", F: "femminile" } as const;
const CATEGORIE = ["M", "F"] as const;

/** The form values of `tappa`, as the inputs hold them. */
function valoriDi(tappa: TappaModifica): Record<CampoTappaModifica, string> {
  return {
    nome: tappa.nome,
    luogo: tappa.luogo,
    data: tappa.data,
    scadenza: tappa.scadenza,
    postiM: String(tappa.tabelloni.M.posti),
    postiF: String(tappa.tabelloni.F.posti),
  };
}

function valoriForm(form: HTMLFormElement): Record<CampoTappaModifica, string> {
  const data = new FormData(form);
  return Object.fromEntries(
    CAMPI_TAPPA_MODIFICA.map((campo) => [campo, String(data.get(campo) ?? "")]),
  ) as Record<CampoTappaModifica, string>;
}

function senza(
  errori: TappaModificaFieldErrors,
  campo: CampoTappaModifica,
): TappaModificaFieldErrors {
  const altri = { ...errori };
  delete altri[campo];
  return altri;
}

function postiDi(valori: Record<CampoTappaModifica, string>) {
  return { M: valori.postiM, F: valori.postiF };
}

type TappaModificaFormProps = {
  tappa: TappaModifica;
  /** The `aggiornaTappa` server action (a fake in Storybook). */
  action: TappaModificaAction;
  /** Starting state, e.g. to show server errors in Storybook. */
  initialState?: TappaModificaFormState;
  /** Where «Annulla» leads. */
  backHref?: string;
};

/**
 * w-admin-tappa-modifica: the stage's data, prefilled, with a hint next to
 * each field. A board's maximum may not drop below its active
 * registrations: the check runs as soon as the value is committed and
 * again on submit, and the server repeats it. The incomplete-groups
 * warning sits above the form on phones and beside it from `lg`.
 */
export function TappaModificaForm({
  tappa,
  action,
  initialState = initialTappaModificaFormState,
  backHref = "/admin/tappe",
}: TappaModificaFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const titoloId = useId();
  const { add: toast } = useToast();
  const path = tappaModificaPath(tappa.id);
  const { restoredAt, clear } = useFormDraft(formRef, {
    id: `tappa-modifica:${tappa.id}`,
    label: `Modifica tappa «${tappa.nome}»`,
    path,
  });

  // `salvata` is the baseline: what the server holds, with its version.
  const [salvata, setSalvata] = useState(tappa);
  // Bumped to remount the inputs with new default values.
  const [generazione, setGenerazione] = useState(0);
  const [valori, setValori] = useState(() => valoriDi(tappa));
  const [errori, setErrori] = useState<TappaModificaFieldErrors>(() =>
    initialState.status === "error" ? initialState.fields : {},
  );
  const [offline, setOffline] = useState(initialState.status === "offline");
  const [tentativi, setTentativi] = useState(0);
  const [conflitto, setConflitto] = useState<TappaModifica | null>(() =>
    initialState.status === "conflict" ? initialState.tappa : null,
  );

  // A new result from the action (adjusting state during render).
  const [statoVisto, setStatoVisto] = useState(state);
  if (state !== statoVisto) {
    setStatoVisto(state);
    setOffline(false);
    if (state.status === "error") {
      setErrori(state.fields);
      setTentativi((n) => n + 1);
    } else if (state.status === "conflict") {
      setConflitto(state.tappa);
    } else if (state.status === "success") {
      setSalvata(state.tappa);
      setValori(valoriDi(state.tappa));
      setErrori({});
      setConflitto(null);
      setGenerazione((n) => n + 1);
    }
  }

  const avvisato = useRef<TappaModificaFormState | null>(null);
  useEffect(() => {
    if (state.status === "success" && avvisato.current !== state) {
      avvisato.current = state;
      clear();
      toast({ title: state.message });
    }
  }, [state, clear, toast]);

  // After the errors have rendered, take the user to the first one.
  useEffect(() => {
    if (tentativi > 0 && formRef.current) focusFirstInvalid(formRef.current);
  }, [tentativi]);

  // A restored draft writes the inputs directly: read them again.
  useEffect(() => {
    if (restoredAt && formRef.current) {
      setValori(valoriForm(formRef.current));
    }
  }, [restoredAt]);

  const iniziali = valoriDi(salvata);
  const modificato = CAMPI_TAPPA_MODIFICA.some(
    (campo) => valori[campo].trim() !== iniziali[campo].trim(),
  );

  function aggiorna() {
    if (formRef.current) setValori(valoriForm(formRef.current));
  }

  function cambia(campo: CampoTappaModifica) {
    aggiorna();
    if (errori[campo]) {
      setErrori((attuali) => senza(attuali, campo));
    }
  }

  /** Checks a board's maximum against its floor. */
  function controllaPosti(categoria: Categoria, raw: string) {
    const campo = CAMPO_POSTI_MODIFICA[categoria];
    const errore = errorePosti(raw, salvata.tabelloni[categoria].iscritti);
    setErrori((attuali) =>
      errore ? { ...attuali, [campo]: errore } : senza(attuali, campo),
    );
  }

  function usaPosti(categoria: Categoria, posti: number) {
    const input = formRef.current?.elements.namedItem(
      CAMPO_POSTI_MODIFICA[categoria],
    );
    if (!(input instanceof HTMLInputElement)) return;
    input.value = String(posti);
    // Lets the local draft see the new value.
    input.dispatchEvent(new Event("input", { bubbles: true }));
    aggiorna();
    controllaPosti(categoria, input.value);
    input.focus();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const result = validaTappaModifica(new FormData(form), salvata);
    if (!result.ok) {
      event.preventDefault();
      setErrori(result.fields);
      setTentativi((n) => n + 1);
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      // The draft is already saved locally; nothing is sent.
      event.preventDefault();
      setOffline(true);
    }
  }

  function usaDatiAggiornati() {
    if (!conflitto) return;
    clear();
    setSalvata(conflitto);
    setValori(valoriDi(conflitto));
    setErrori({});
    setConflitto(null);
    setGenerazione((n) => n + 1);
  }

  function mantieniModifiche() {
    if (!conflitto) return;
    // The next save overwrites the newer data, knowingly.
    setSalvata({ ...salvata, versione: conflitto.versione });
    setConflitto(null);
  }

  const bloccato =
    state.status === "sessionExpired" || state.status === "permissionDenied";
  const messaggioGenerale =
    state.status === "error" && Object.keys(state.fields).length === 0
      ? state.message
      : state.status === "unavailable"
        ? state.message
        : null;

  return (
    <div className="grid items-start gap-stack-lg lg:grid-cols-[minmax(0,1fr)_34%]">
      <UnsavedChangesGuard when={modificato && !pending} />

      {/* First in the DOM: above the form on phones, beside it from lg. */}
      <div className="lg:sticky lg:top-[calc(var(--app-topbar-h,0px)+1rem)] lg:order-last">
        <GironiPanel
          posti={postiDi(valori)}
          iscritti={{
            M: salvata.tabelloni.M.iscritti,
            F: salvata.tabelloni.F.iscritti,
          }}
          onUsa={usaPosti}
        />
      </div>

      <form
        ref={formRef}
        action={formAction}
        onSubmit={onSubmit}
        noValidate
        aria-labelledby={titoloId}
        className="flex min-w-0 flex-col gap-stack-lg"
      >
        <input type="hidden" name="id" value={salvata.id} />
        <input
          type="hidden"
          name="versione"
          value={salvata.versione}
          data-no-draft
        />

        <div className="flex flex-col gap-space-2">
          <h2 id={titoloId} className="font-heading text-xl font-semibold">
            Dati della tappa
          </h2>
          <Tape size={4} className="max-w-24" />
        </div>

        {conflitto ? (
          <section
            role="alert"
            aria-label="Conflitto di versione"
            data-slot="conflitto"
            className="flex flex-col items-start gap-space-3 border-2 border-error-fg bg-error-bg p-inset text-error-fg"
          >
            <p className="flex items-start gap-space-2 font-semibold">
              <RefreshCwIcon aria-hidden className="mt-1 size-4 shrink-0" />
              {M.conflict}
            </p>
            <dl className="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-x-space-4 gap-y-space-1 text-foreground">
              {riepilogoTappa(conflitto).map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="font-semibold">{label}</dt>
                  <dd className="font-mono [overflow-wrap:anywhere]">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-space-3">
              <Button type="button" onClick={usaDatiAggiornati}>
                Usa i dati aggiornati
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={mantieniModifiche}
              >
                Mantieni le mie modifiche
              </Button>
            </div>
          </section>
        ) : null}

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
              href={sessionExpiredHref(path)}
              className={buttonVariants({ variant: "primary" })}
            >
              Accedi di nuovo
            </Link>
          </div>
        ) : null}

        {state.status === "permissionDenied" ||
        state.status === "nonModificabile" ? (
          <p
            role="alert"
            className="flex items-start gap-space-2 border-2 border-error-fg bg-error-bg p-inset font-semibold text-error-fg"
          >
            <LockIcon aria-hidden className="mt-1 size-4 shrink-0" />
            {state.message}
          </p>
        ) : null}

        {offline ? (
          <p
            role="alert"
            className="flex items-start gap-space-2 border-2 border-warning-fg bg-warning-bg p-inset font-semibold text-warning-fg"
          >
            <CloudOffIcon aria-hidden className="mt-1 size-4 shrink-0" />
            {M.offline}
          </p>
        ) : null}

        {/* Remounted with new default values after a save or a reload. */}
        <div key={generazione} className="contents">
          <Field
            label="Nome della tappa"
            required
            error={errori.nome}
            hint="Come compare nel calendario e nelle classifiche."
            className="max-w-md"
          >
            <Input
              name="nome"
              maxLength={120}
              defaultValue={salvata.nome}
              onChange={() => cambia("nome")}
            />
          </Field>

          <Field
            label="Luogo"
            required
            error={errori.luogo}
            hint="Città e spiaggia o stabilimento."
            className="max-w-md"
          >
            <Input
              name="luogo"
              maxLength={200}
              defaultValue={salvata.luogo}
              onChange={() => cambia("luogo")}
            />
          </Field>

          <Field
            label="Primo giorno di gioco"
            required
            error={errori.data}
            hint="Se la cambi, tutta la tappa si sposta e la durata resta la stessa."
            className="max-w-md"
          >
            <Input
              name="data"
              type="date"
              defaultValue={salvata.data}
              className="max-w-56 font-mono"
              onChange={() => cambia("data")}
            />
          </Field>

          <Field
            label="Scadenza delle iscrizioni"
            required
            error={errori.scadenza}
            hint="Ora italiana. Deve cadere prima della mezzanotte del primo giorno."
            className="max-w-md"
          >
            <Input
              name="scadenza"
              type="datetime-local"
              defaultValue={salvata.scadenza}
              className="max-w-64 font-mono"
              onChange={() => cambia("scadenza")}
            />
          </Field>

          {CATEGORIE.map((categoria) => (
            <PostiField
              key={categoria}
              categoria={categoria}
              defaultValue={salvata.tabelloni[categoria].posti}
              iscritti={salvata.tabelloni[categoria].iscritti}
              error={errori[CAMPO_POSTI_MODIFICA[categoria]]}
              onInput={aggiorna}
              onCommit={(raw) => controllaPosti(categoria, raw)}
            />
          ))}
        </div>

        <div className="flex flex-col gap-space-3">
          {messaggioGenerale ? (
            <p
              role="alert"
              className="flex items-start gap-space-2 font-semibold text-error-fg"
            >
              <AlertCircleIcon aria-hidden className="mt-1 size-4 shrink-0" />
              {messaggioGenerale}
            </p>
          ) : null}
          {state.status === "error" && messaggioGenerale === null ? (
            <p className="flex items-start gap-space-2 font-semibold text-error-fg">
              <AlertCircleIcon aria-hidden className="mt-1 size-4 shrink-0" />
              {state.message}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-space-3">
            {/* `loading` blocks a second submit and keeps focus. */}
            <Button
              type="submit"
              loading={pending}
              disabled={bloccato || conflitto !== null}
              disabledReason={
                conflitto
                  ? "Scegli prima quali dati tenere."
                  : bloccato
                    ? "Non puoi salvare finché non risolvi il problema qui sopra."
                    : undefined
              }
            >
              Salva modifiche
            </Button>
            <Link
              href={backHref}
              className={buttonVariants({ variant: "secondary" })}
            >
              {modificato ? "Annulla" : "Torna alla tappa"}
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}

type PostiFieldProps = {
  categoria: Categoria;
  defaultValue: number;
  iscritti: number;
  error?: string;
  onInput: () => void;
  /** A pause in typing or Enter: the value is checked against the floor. */
  onCommit: (raw: string) => void;
};

/**
 * How long typing must pause before the floor check runs. Not on blur: the
 * error would push «Salva modifiche» down between mousedown and click.
 */
export const POSTI_CHECK_DELAY_MS = 600;

/**
 * A board's maximum, with the current registrations beside it. The error
 * appears right after the control and is also announced from a polite
 * status region that is always in the DOM, because it can show up without
 * a submit.
 */
function PostiField({
  categoria,
  defaultValue,
  iscritti,
  error,
  onInput,
  onCommit,
}: PostiFieldProps) {
  const minimo = Math.max(POSTI_MIN, iscritti);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function commit(raw: string) {
    clearTimeout(timer.current);
    onCommit(raw);
  }

  return (
    <Field
      label={`Massimo iscritti · tabellone ${TABELLONE[categoria]}`}
      required
      error={error}
      hint={
        <>
          Iscritti attuali:{" "}
          <span className="font-mono font-semibold text-foreground">
            {iscritti}
          </span>
          . Il massimo va da <span className="font-mono">{minimo}</span> a{" "}
          <span className="font-mono">{POSTI_MAX}</span>.
        </>
      }
      className="max-w-md"
    >
      <Input
        name={CAMPO_POSTI_MODIFICA[categoria]}
        type="number"
        inputMode="numeric"
        min={minimo}
        max={POSTI_MAX}
        step={1}
        defaultValue={defaultValue}
        className="max-w-40 font-mono"
        onInput={(event) => {
          onInput();
          const raw = event.currentTarget.value;
          clearTimeout(timer.current);
          timer.current = setTimeout(() => onCommit(raw), POSTI_CHECK_DELAY_MS);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit(event.currentTarget.value);
        }}
      />
      <p role="status" data-slot="posti-annuncio" className="sr-only">
        {error ? `Errore: ${error}` : ""}
      </p>
    </Field>
  );
}
