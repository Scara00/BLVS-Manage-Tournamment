"use client";

import { AlertCircleIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
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
import { RadioCard, RadioCardGroup } from "@/components/ui/radio-card";
import type { Categoria } from "@/lib/db/types";
import { NOME_MAX_CARATTERI } from "@/lib/iscrizioni/admin/messages";
import { iscrittiPath } from "@/lib/iscrizioni/admin/paths";
import {
  initialModificaIscrittiState,
  type ModificaIscrittiAction,
  type ModificaIscrittiState,
} from "@/lib/iscrizioni/admin/types";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";
import { CATEGORIA_TABELLONE } from "@/lib/tappe/gestione-format";
import { useAzioneIscritti } from "./use-azione-iscritti";

type AggiungiManualeDialogProps = {
  tappaId: string;
  /** The `aggiungiIscrittoManuale` server action (a fake in Storybook). */
  action: ModificaIscrittiAction;
  /** Storybook: open on mount, with a result. */
  defaultOpen?: boolean;
  initialState?: ModificaIscrittiState;
};

type Errori = { nome?: string; cognome?: string; categoria?: string };

/**
 * w-admin-aggiungi-manuale: registers someone with no account, from name,
 * surname and category. The dialog stays open after each player, on an
 * empty name and with the same category, so a stage fills up quickly; the
 * list behind it updates as it goes. The server applies the rules of
 * «Aggiungi giocatore» (maximum, stage state).
 */
export function AggiungiManualeDialog({
  tappaId,
  action,
  defaultOpen = false,
  initialState = initialModificaIscrittiState,
}: AggiungiManualeDialogProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [categoria, setCategoria] = useState<Categoria | null>(null);
  const [errori, setErrori] = useState<Errori>({});
  const formRef = useRef<HTMLFormElement>(null);
  const nomeRef = useRef<HTMLInputElement>(null);
  const cognomeRef = useRef<HTMLInputElement>(null);

  const safeAction = useAzioneIscritti(action);
  const [state, formAction, pending] = useActionState(safeAction, initialState);

  // A new result (adjusting state during render): a success empties the
  // names for the next player.
  const [visto, setVisto] = useState(state);
  const [mostraEsito, setMostraEsito] = useState(
    initialState.status !== "idle",
  );
  if (state !== visto) {
    setVisto(state);
    setMostraEsito(true);
    if (state.status === "success") {
      setNome("");
      setCognome("");
    }
  }

  useEffect(() => {
    if (state.status === "success") nomeRef.current?.focus();
  }, [state]);

  // After the render, so the field is read out with its error.
  useEffect(() => {
    if (errori.nome) nomeRef.current?.focus();
    else if (errori.cognome) cognomeRef.current?.focus();
    else if (errori.categoria) {
      formRef.current?.querySelector<HTMLElement>('[role="radio"]')?.focus();
    }
  }, [errori]);

  const errore = state.status === "error" && mostraEsito ? state : null;
  const aggiunto = state.status === "success" && mostraEsito ? state : null;

  function nascondiErrore() {
    if (errore) setMostraEsito(false);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const mancanti: Errori = {
      nome: nome.trim() ? undefined : "Inserisci il nome.",
      cognome: cognome.trim() ? undefined : "Inserisci il cognome.",
      categoria: categoria ? undefined : "Scegli la categoria.",
    };
    setErrori(mancanti);
    if (mancanti.nome || mancanti.cognome || mancanti.categoria) return;
    const formData = new FormData();
    formData.set("tappaId", tappaId);
    formData.set("nome", nome);
    formData.set("cognome", cognome);
    formData.set("categoria", categoria as Categoria);
    startTransition(() => formAction(formData));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (next) {
          // Every opening starts clean, the category aside.
          setNome("");
          setCognome("");
          setErrori({});
          setMostraEsito(false);
        }
        setOpen(next);
      }}
    >
      <DialogTrigger
        render={<Button variant="secondary" className="max-w-full" />}
      >
        <PencilIcon aria-hidden className="size-4" />
        Aggiungi a mano
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <form ref={formRef} noValidate onSubmit={onSubmit} className="contents">
          <DialogHeader>
            <DialogTitle>Aggiungi a mano</DialogTitle>
            <DialogDescription>
              Per chi non ha un account: va nel tabellone della sua categoria,
              al primo posto libero, con l&apos;iscrizione già confermata. Non
              può accedere all&apos;app e non riceve email.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-stack-sm">
            <Field label="Nome" required error={errori.nome}>
              <Input
                ref={nomeRef}
                autoComplete="off"
                maxLength={NOME_MAX_CARATTERI}
                value={nome}
                onValueChange={(valore) => {
                  setNome(valore);
                  nascondiErrore();
                }}
              />
            </Field>
            <Field label="Cognome" required error={errori.cognome}>
              <Input
                ref={cognomeRef}
                autoComplete="off"
                maxLength={NOME_MAX_CARATTERI}
                value={cognome}
                onValueChange={(valore) => {
                  setCognome(valore);
                  nascondiErrore();
                }}
              />
            </Field>
            <RadioCardGroup
              legend="Categoria"
              required
              error={errori.categoria}
              value={categoria}
              onValueChange={(valore) => {
                setCategoria(valore as Categoria);
                nascondiErrore();
              }}
            >
              <RadioCard value="M" title={CATEGORIA_TABELLONE.M} />
              <RadioCard value="F" title={CATEGORIA_TABELLONE.F} />
            </RadioCardGroup>
            <p
              role="status"
              data-testid="manuale-esito"
              className="min-h-6 font-medium"
            >
              {aggiunto?.message}
            </p>
            {errore ? (
              <div
                role="alert"
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
                    href={sessionExpiredHref(iscrittiPath(tappaId))}
                    className={buttonVariants({ variant: "primary" })}
                  >
                    Accedi di nuovo
                  </Link>
                ) : null}
              </div>
            ) : null}
          </DialogBody>
          <DialogFooter showCloseButton>
            <Button type="submit" variant="primary" loading={pending}>
              Aggiungi
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
