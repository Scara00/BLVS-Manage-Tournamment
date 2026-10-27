"use client";

import { AlertCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  type FormEvent,
} from "react";
import { Tape } from "@/components/scoreboard";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, focusFirstInvalid } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useFormDraft } from "@/lib/drafts/use-form-draft";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";
import {
  NUOVA_TAPPA_PATH,
  POSTI_PREDEFINITI,
  initialNuovaTappaFormState,
  type NuovaTappaAction,
  type NuovaTappaFormState,
} from "@/lib/tappe/nuova/types";
import { PostiField } from "./posti-field";

type NuovaTappaFormProps = {
  /** The `creaTappa` server action (a fake in Storybook). */
  action: NuovaTappaAction;
  /** Starting state, e.g. to show server errors in Storybook. */
  initialState?: NuovaTappaFormState;
  /** Starting maximum of each board. */
  posti?: { M: number; F: number };
};

function Avviso({
  state,
}: {
  state: Exclude<NuovaTappaFormState, { status: "idle" | "success" }>;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-space-3 border-2 border-error-fg bg-error-bg p-inset text-error-fg"
    >
      <p className="flex items-start gap-space-2 font-semibold">
        <AlertCircleIcon aria-hidden className="mt-1 size-4 shrink-0" />
        {state.message}
      </p>
      {state.status === "sessionExpired" ? (
        <Link
          href={sessionExpiredHref(NUOVA_TAPPA_PATH)}
          className={buttonVariants({ variant: "primary" })}
        >
          Accedi di nuovo
        </Link>
      ) : null}
    </div>
  );
}

/**
 * w-admin-tappa-nuova: name, place, day, registration deadline (Europe/Rome)
 * and the maximum of each board. The stage is created in draft with its two
 * independent boards, M and F. Errors sit under each field and focus moves
 * to the first one; a maximum with incomplete groups only warns.
 */
export function NuovaTappaForm({
  action,
  initialState = initialNuovaTappaFormState,
  posti = { M: POSTI_PREDEFINITI, F: POSTI_PREDEFINITI },
}: NuovaTappaFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const toast = useToast();
  const { restoredAt, clear } = useFormDraft(formRef, {
    id: "admin-tappa-nuova",
    label: "Nuova tappa",
    path: NUOVA_TAPPA_PATH,
  });

  useEffect(() => {
    if (state.status === "error" && formRef.current) {
      focusFirstInvalid(formRef.current);
    }
    if (state.status === "success") {
      clear();
      toast.add({ title: state.message });
      router.replace(state.href);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per result
  }, [state]);

  // Not a form `action`: React would reset the uncontrolled fields after
  // every submit, wiping what the admin typed when the server refuses it.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || state.status === "success") return;
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  const fields = state.status === "error" ? state.fields : {};
  const avviso =
    state.status === "idle" ||
    state.status === "success" ||
    (state.status === "error" && Object.keys(state.fields).length > 0)
      ? null
      : state;

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      aria-labelledby="nuova-tappa-titolo"
      className="flex max-w-2xl flex-col gap-stack-lg"
    >
      <div className="flex flex-col gap-space-2">
        <h2
          id="nuova-tappa-titolo"
          className="font-heading text-xl font-semibold"
        >
          Dati della tappa
        </h2>
        <Tape size={4} className="max-w-24" />
      </div>

      {avviso ? <Avviso state={avviso} /> : null}

      <Field label="Nome" required error={fields.nome} className="max-w-md">
        <Input name="nome" maxLength={120} autoComplete="off" />
      </Field>

      <Field label="Luogo" required error={fields.luogo} className="max-w-md">
        <Input name="luogo" maxLength={200} autoComplete="off" />
      </Field>

      <Field
        label="Data"
        required
        error={fields.data}
        hint="Un solo giorno di gioco, a partire da domani."
        className="max-w-md"
      >
        <Input name="data" type="date" className="max-w-56 font-mono" />
      </Field>

      <Field
        label="Scadenza delle iscrizioni"
        required
        error={fields.scadenza}
        hint="Data e ora italiane (Europe/Rome), prima del giorno della tappa."
        className="max-w-md"
      >
        <Input
          name="scadenza"
          type="datetime-local"
          className="max-w-72 font-mono"
        />
      </Field>

      <fieldset className="m-0 flex min-w-0 flex-col gap-stack p-0">
        <legend className="mb-space-2 p-0 font-heading text-xl font-semibold">
          Tabelloni
        </legend>
        <p className="max-w-prose">
          La tappa nasce <strong>in bozza</strong> con due tabelloni
          indipendenti, maschile (M) e femminile (F), ciascuno con il suo
          massimo di iscritti.
        </p>
        <PostiField
          categoria="M"
          defaultValue={posti.M}
          error={fields.postiM}
          restoredAt={restoredAt}
        />
        <PostiField
          categoria="F"
          defaultValue={posti.F}
          error={fields.postiF}
          restoredAt={restoredAt}
        />
      </fieldset>

      <div className="flex flex-wrap items-center gap-space-3">
        <Button type="submit" loading={pending} className="max-w-full">
          Crea tappa in bozza
        </Button>
        <Link
          href="/admin/tappe"
          className={buttonVariants({
            variant: "secondary",
            className: "max-w-full",
          })}
        >
          Annulla
        </Link>
      </div>
    </form>
  );
}
