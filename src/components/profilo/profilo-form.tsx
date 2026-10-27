"use client";

import { AlertCircleIcon, CheckCircle2Icon, LockIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { CategoryLabel, Tape } from "@/components/scoreboard";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldError, focusFirstInvalid } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioCard, RadioCardGroup } from "@/components/ui/radio-card";
import type { Categoria } from "@/lib/db/types";
import { profiloSessionExpiredHref } from "@/lib/profilo/paths";
import {
  PROFILO_MESSAGES,
  PROFILO_MODIFICA_PATH,
  PROFILO_PATH,
  emailInAttesaMessage,
  initialProfiloFormState,
  type Profilo,
  type ProfiloAction,
  type ProfiloFormState,
  type ProfiloValori,
} from "@/lib/profilo/types";
import { cn } from "@/lib/utils";
import { CATEGORIA_LABEL, CATEGORIA_TESTO } from "./categoria";
import { UnsavedChangesGuard } from "./unsaved-changes-guard";

function valoriDi(profilo: Profilo): ProfiloValori {
  const { nome, cognome, email, categoria } = profilo;
  return { nome, cognome, email, categoria };
}

/** Whether the form differs from what is saved (email case-insensitive). */
export function haModifiche(a: ProfiloValori, b: ProfiloValori): boolean {
  return (
    a.nome.trim() !== b.nome.trim() ||
    a.cognome.trim() !== b.cognome.trim() ||
    a.email.trim().toLowerCase() !== b.email.trim().toLowerCase() ||
    a.categoria !== b.categoria
  );
}

type ProfiloFormProps = {
  profilo: Profilo;
  /** The `aggiornaProfilo` server action (a fake in Storybook). */
  action: ProfiloAction;
  /** Starting state, e.g. to show server errors in Storybook. */
  initialState?: ProfiloFormState;
};

/**
 * w-profilo-modifica: name, surname, email and, until the first stage is
 * played, category. Errors sit under each field and focus moves to the
 * first one; leaving with unsaved changes asks for confirmation.
 */
export function ProfiloForm({
  profilo,
  action,
  initialState = initialProfiloFormState,
}: ProfiloFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const categoriaId = useId();

  const [salvati, setSalvati] = useState(() => valoriDi(profilo));
  const [valori, setValori] = useState(salvati);
  const [emailInAttesa, setEmailInAttesa] = useState(profilo.emailInAttesa);

  // A new result from the action: after a save, what was submitted is the
  // new baseline (adjusting state during render, not in an effect).
  const [statoVisto, setStatoVisto] = useState(state);
  if (state !== statoVisto) {
    setStatoVisto(state);
    if (state.status === "success") {
      setSalvati(state.values);
      if (state.emailInAttesa) setEmailInAttesa(state.emailInAttesa);
    }
  }

  // After the errors have rendered, take the user to the first one; the
  // state object is new on every failed submit, so this runs every time.
  useEffect(() => {
    if (state.status === "error" && formRef.current) {
      focusFirstInvalid(formRef.current);
    }
  }, [state]);

  const fields = state.status === "error" ? state.fields : {};
  const modificato = haModifiche(valori, salvati);
  const categoriaModificabile =
    profilo.statoCategoria === "modificabile" || profilo.categoria === null;

  function set<K extends keyof ProfiloValori>(key: K) {
    return (value: ProfiloValori[K]) =>
      setValori((current) => ({ ...current, [key]: value }));
  }

  return (
    <>
      <UnsavedChangesGuard when={modificato && !pending} />
      <form
        ref={formRef}
        action={formAction}
        noValidate
        aria-labelledby="profilo-modifica-titolo"
        className="flex max-w-2xl flex-col gap-stack-lg"
      >
        <div className="flex flex-col gap-space-2">
          <h2
            id="profilo-modifica-titolo"
            className="font-heading text-xl font-semibold"
          >
            Dati personali
          </h2>
          <Tape size={4} className="max-w-24" />
        </div>

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
              href={profiloSessionExpiredHref(PROFILO_MODIFICA_PATH)}
              className={buttonVariants({ variant: "primary" })}
            >
              Accedi di nuovo
            </Link>
          </div>
        ) : null}

        <Field label="Nome" required error={fields.nome} className="max-w-md">
          <Input
            name="nome"
            autoComplete="given-name"
            maxLength={100}
            value={valori.nome}
            onValueChange={set("nome")}
          />
        </Field>

        <Field
          label="Cognome"
          required
          error={fields.cognome}
          className="max-w-md"
        >
          <Input
            name="cognome"
            autoComplete="family-name"
            maxLength={100}
            value={valori.cognome}
            onValueChange={set("cognome")}
          />
        </Field>

        <Field
          label="Email"
          required
          error={fields.email}
          hint="Se la cambi, ti mandiamo un link di conferma sia al nuovo sia all'attuale indirizzo: il cambio vale solo dopo averli aperti entrambi."
          className="max-w-md"
        >
          <Input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            maxLength={254}
            className="font-mono"
            value={valori.email}
            onValueChange={set("email")}
          />
        </Field>

        {emailInAttesa ? (
          <div className="flex max-w-md flex-col items-start gap-space-2 border-l-4 border-tape pl-space-3">
            <Badge variant="warning">Cambio email in attesa di conferma</Badge>
            <p className="text-base [overflow-wrap:anywhere]">
              {emailInAttesaMessage(emailInAttesa, profilo.email)}
            </p>
          </div>
        ) : null}

        {categoriaModificabile ? (
          <RadioCardGroup<Categoria>
            legend="Categoria"
            name="categoria"
            required={profilo.categoria !== null}
            hint={
              profilo.statoCategoria === "modificabile"
                ? "Dopo la prima tappa giocata non potrai più cambiarla."
                : undefined
            }
            error={fields.categoria}
            value={valori.categoria ?? undefined}
            onValueChange={(value) => set("categoria")(value)}
            className="max-w-md"
          >
            <RadioCard<Categoria> value="M" title={CATEGORIA_TESTO.M} />
            <RadioCard<Categoria> value="F" title={CATEGORIA_TESTO.F} />
          </RadioCardGroup>
        ) : (
          <div
            role="group"
            aria-labelledby={`${categoriaId}-label`}
            aria-describedby={`${categoriaId}-motivo`}
            data-slot="categoria-sola-lettura"
            className="flex max-w-md flex-col items-start gap-space-2"
          >
            <p
              id={`${categoriaId}-label`}
              className="font-heading text-base font-semibold text-foreground"
            >
              Categoria
            </p>
            <p className="flex flex-wrap items-center gap-space-3 border-2 border-neutral-300 bg-neutral-100 px-space-3 py-space-2">
              <LockIcon aria-hidden className="size-5 shrink-0" />
              {profilo.categoria ? (
                <CategoryLabel
                  category={CATEGORIA_LABEL[profilo.categoria]}
                  className="text-base"
                />
              ) : null}
              <Badge variant="neutral">
                {profilo.statoCategoria === "bloccata"
                  ? "Categoria bloccata"
                  : "Non modificabile ora"}
              </Badge>
            </p>
            <p
              id={`${categoriaId}-motivo`}
              className="text-sm text-muted-foreground"
            >
              {profilo.statoCategoria === "bloccata"
                ? PROFILO_MESSAGES.categoria.bloccata
                : PROFILO_MESSAGES.categoria.iscrizione_attiva}
            </p>
            {fields.categoria ? (
              <FieldError>{fields.categoria}</FieldError>
            ) : null}
          </div>
        )}

        <div className="flex flex-col gap-space-3">
          {state.status === "error" ? (
            <p
              // Field errors are reached by focus; a general failure has
              // no field, so it is announced.
              role={Object.keys(fields).length === 0 ? "alert" : undefined}
              className="flex items-start gap-space-2 font-semibold text-error-fg"
            >
              <AlertCircleIcon aria-hidden className="mt-1 size-4 shrink-0" />
              {state.message}
            </p>
          ) : null}
          <p
            role="status"
            className={cn(
              "flex items-start gap-space-2 font-semibold text-success-fg",
              state.status !== "success" && "sr-only",
            )}
          >
            {state.status === "success" ? (
              <>
                <CheckCircle2Icon
                  aria-hidden
                  className="mt-1 size-4 shrink-0"
                />
                {state.emailInAttesa
                  ? `${state.message} Controlla la posta per confermare la nuova email.`
                  : state.message}
              </>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-space-3">
            {/* `loading` blocks a second submit and keeps focus. */}
            <Button type="submit" loading={pending}>
              Salva modifiche
            </Button>
            <Link
              href={PROFILO_PATH}
              className={buttonVariants({ variant: "secondary" })}
            >
              {modificato ? "Annulla" : "Torna al profilo"}
            </Link>
          </div>
        </div>
      </form>
    </>
  );
}
