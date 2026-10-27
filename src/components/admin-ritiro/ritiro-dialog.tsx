"use client";

import { AlertCircleIcon, UserMinusIcon, WifiOffIcon } from "lucide-react";
import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { ImpattoFase } from "@/components/admin-punteggio/impatto-fase";
import { Tape } from "@/components/scoreboard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, Fieldset, focusFirstInvalid } from "@/components/ui/field";
import { RadioCard, RadioCardGroup } from "@/components/ui/radio-card";
import { Select } from "@/components/ui/select";
import type { Categoria } from "@/lib/db/types";
import type { SceltaImpatto } from "@/lib/punteggi/correzione/types";
import {
  anteprimaRitiro,
  cosaCambiaRitiro,
  descriviCambio,
  descriviRisultato,
  giocatoriGirone,
  partiteDelGiocatore,
  preselezione,
} from "@/lib/ritiri/anteprima";
import {
  etichettaRegistra,
  RITIRO_MESSAGES,
  testiImpattoRitiro,
} from "@/lib/ritiri/format";
import { spiegaRegolaRitiro } from "@/lib/ritiri/regola";
import {
  initialRitiroState,
  TIPI_RITIRO,
  TIPO_RITIRO_LABEL,
  type AssenzaRegistrata,
  type RitiroAction,
  type RitiroState,
  type TipoRitiro,
} from "@/lib/ritiri/types";
import { campoPartita } from "@/lib/ritiri/validazione";
import { CATEGORIA_SEGMENTO } from "@/lib/tappe/avvio/paths";
import { descriviPartita } from "@/lib/tappe/live-admin/format";
import type { PartitaLive } from "@/lib/tappe/live-admin/types";

const DESCRIZIONE_TIPO: Record<TipoRitiro, string> = {
  ritiro:
    "Il giocatore lascia la tappa: sono scelte tutte le sue partite non ancora concluse.",
  assenza: "Il giocatore salta solo alcune partite: scegli quali.",
};

export type RitiroDialogProps = {
  tappaId: string;
  categoria: Categoria;
  girone: { id: string; nome: string };
  /** The group's matches (live: the newest the page has). */
  partite: readonly PartitaLive[];
  /** Absences already recorded on the board. */
  assenze: readonly AssenzaRegistrata[];
  /** `registraRitiro`; a fake in Storybook and tests. */
  action: RitiroAction;
  online: boolean;
  /** Points at the page's offline notice while offline. */
  describedBy?: string;
  /** A success goes to the page's message area, which takes focus. */
  onEsito: (state: Extract<RitiroState, { status: "success" }>) => void;
  /** Storybook: open at once, with a starting outcome and choices. */
  defaultOpen?: boolean;
  initialState?: RitiroState;
  defaultGiocatore?: string;
  defaultTipo?: TipoRitiro;
};

/**
 * w-admin-ritiro: records a withdrawal or an absence of one player of the
 * group. The admin picks the player, the type and the matches; the rule
 * (Q-09) is written out with a preview of each match and of the group
 * standing. If the next phase already exists, BLVS-41's
 * w-admin-impatto-fase opens on top. Errors appear next to their field,
 * which takes focus.
 */
export function RitiroDialog({
  tappaId,
  categoria,
  girone,
  partite,
  assenze,
  action,
  online,
  describedBy,
  onEsito,
  defaultOpen = false,
  initialState = initialRitiroState,
  defaultGiocatore = "",
  defaultTipo,
}: RitiroDialogProps) {
  const ids = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  // The dialog keeps the matches it was opened with: the preview and the
  // versions sent stay those the admin looked at.
  const [nelDialog, setNelDialog] = useState(partite);
  const [giocatore, setGiocatore] = useState(defaultGiocatore);
  const [tipo, setTipo] = useState<TipoRitiro | null>(defaultTipo ?? null);
  const [scelte, setScelte] = useState<string[]>(() =>
    defaultTipo && defaultGiocatore
      ? preselezione(
          defaultTipo,
          partiteDelGiocatore(partite, defaultGiocatore, assenze),
        )
      : [],
  );
  const [impattoAperto, setImpattoAperto] = useState(
    initialState.status === "impatto",
  );
  const [sceltaInCorso, setSceltaInCorso] = useState<SceltaImpatto | null>(
    null,
  );

  const safeAction = useCallback<RitiroAction>(
    async (prev, formData) => {
      try {
        return await action(prev, formData);
      } catch (error) {
        console.error("[ritiri] richiesta non riuscita", error);
        return {
          status: "error",
          reason: "network",
          message: RITIRO_MESSAGES.network,
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
    if (state.status === "impatto") setImpattoAperto(true);
    if (state.status === "success") {
      setImpattoAperto(false);
      setOpen(false);
    }
  }

  useEffect(() => {
    if (state.status === "success") {
      onEsito(state);
      return;
    }
    if (state.status === "fieldErrors") {
      requestAnimationFrame(() => {
        if (formRef.current) focusFirstInvalid(formRef.current);
      });
    }
  }, [state, onEsito]);

  const giocatori = giocatoriGirone(nelDialog);
  const nome = giocatori.find((g) => g.iscrizioneId === giocatore)?.nome ?? "";
  const delGiocatore = giocatore
    ? partiteDelGiocatore(nelDialog, giocatore, assenze)
    : [];
  const anteprima = giocatore
    ? anteprimaRitiro(nelDialog, giocatore, scelte)
    : [];
  const cambi =
    giocatore && scelte.length > 0
      ? cosaCambiaRitiro(nelDialog, giocatore, scelte)
      : [];
  const errori = state.status === "fieldErrors" ? state.errori : {};
  const errore = state.status === "error" ? state : null;

  function invia(impatto?: {
    scelta: SceltaImpatto;
    conferma: boolean;
    attesi: number;
  }) {
    if (pending || !online) return;
    const fd = new FormData();
    fd.set("tappaId", tappaId);
    fd.set("categoria", CATEGORIA_SEGMENTO[categoria]);
    fd.set("iscrizioneId", giocatore);
    fd.set("nome", nome);
    if (tipo) fd.set("tipo", tipo);
    for (const p of nelDialog) {
      if (scelte.includes(p.id))
        fd.append("partita", campoPartita(p.id, p.versione));
    }
    if (impatto) {
      fd.set("scelta", impatto.scelta);
      fd.set("conferma", impatto.conferma ? "1" : "");
      fd.set("attesi", String(impatto.attesi));
    }
    setSceltaInCorso(impatto?.scelta ?? null);
    startTransition(() => formAction(fd));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    invia();
  }

  function scegliGiocatore(id: string) {
    setGiocatore(id);
    setScelte(
      tipo && id
        ? preselezione(tipo, partiteDelGiocatore(nelDialog, id, assenze))
        : [],
    );
  }

  function scegliTipo(valore: TipoRitiro) {
    setTipo(valore);
    setScelte(preselezione(valore, delGiocatore));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (next) {
          setNelDialog(partite);
          setGiocatore("");
          setTipo(null);
          setScelte([]);
        }
        setOpen(next);
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="secondary"
            size="campo"
            className="max-w-full self-start"
            disabled={!online}
            focusableWhenDisabled={!online}
            aria-describedby={describedBy}
            aria-label={`Ritiro o assenza: ${girone.nome}`}
            data-testid="ritiro-apri"
          />
        }
      >
        <UserMinusIcon aria-hidden />
        Ritiro o assenza
      </DialogTrigger>
      <DialogContent className="max-w-xl" data-testid="ritiro-dialog">
        <form
          ref={formRef}
          noValidate
          onSubmit={onSubmit}
          className="flex min-h-0 flex-col gap-stack"
          data-testid="ritiro-form"
        >
          <DialogHeader>
            <DialogTitle>Ritiro o assenza · {girone.nome}</DialogTitle>
            <DialogDescription>
              Scegli il giocatore, il tipo e le partite. Prima di registrare
              vedi la regola applicata e il risultato.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-stack">
            {errore ? (
              <p
                role="alert"
                data-testid="ritiro-errore"
                className="flex items-start gap-space-2 border-2 border-error-fg bg-error-bg p-space-3 font-semibold text-error-fg"
              >
                <AlertCircleIcon aria-hidden className="mt-1 size-4 shrink-0" />
                {errore.message}
              </p>
            ) : null}

            <Field
              label="Giocatore"
              size="campo"
              required
              error={errori.giocatore}
            >
              <Select
                value={giocatore}
                onChange={(e) => scegliGiocatore(e.target.value)}
                placeholder="Scegli un giocatore"
                disabled={pending}
              >
                {giocatori.map((g) => (
                  <option key={g.iscrizioneId} value={g.iscrizioneId}>
                    {g.nome}
                  </option>
                ))}
              </Select>
            </Field>

            <RadioCardGroup<TipoRitiro | null>
              legend="Tipo"
              size="campo"
              required
              value={tipo}
              onValueChange={(value) => {
                if (value) scegliTipo(value);
              }}
              error={errori.tipo}
              disabled={pending}
            >
              {TIPI_RITIRO.map((t) => (
                <RadioCard
                  key={t}
                  value={t}
                  title={TIPO_RITIRO_LABEL[t]}
                  description={DESCRIZIONE_TIPO[t]}
                />
              ))}
            </RadioCardGroup>

            <Fieldset
              legend="Partite"
              size="campo"
              required
              error={errori.partite}
              hint={
                giocatore
                  ? undefined
                  : "Scegli prima il giocatore: qui compaiono le sue partite."
              }
              disabled={pending}
              data-testid="ritiro-partite"
            >
              {delGiocatore.map(({ partita, disponibile, motivo }) => (
                <Checkbox
                  key={partita.id}
                  label={
                    <>
                      {descriviPartita(partita)}
                      {" · "}
                      <span className="font-mono">
                        {descriviRisultato(partita.stato, partita.sets)}
                      </span>
                      {motivo ? ` · ${motivo}` : null}
                    </>
                  }
                  checked={scelte.includes(partita.id)}
                  disabled={!disponibile || pending}
                  onCheckedChange={(checked) =>
                    setScelte((s) =>
                      checked
                        ? [...s, partita.id]
                        : s.filter((id) => id !== partita.id),
                    )
                  }
                />
              ))}
            </Fieldset>

            <section
              aria-labelledby={`${ids}-regola`}
              data-testid="ritiro-regola"
              className="flex flex-col gap-space-2 border-2 border-primary p-space-3"
            >
              <h3 id={`${ids}-regola`} className="font-heading font-semibold">
                Regola applicata
              </h3>
              <Tape size={4} className="max-w-16" />
              <p>{spiegaRegolaRitiro()}</p>
              {anteprima.length > 0 ? (
                <>
                  <h4 className="font-heading font-semibold">
                    Anteprima del risultato
                  </h4>
                  <ul
                    className="flex flex-col gap-space-2"
                    data-testid="ritiro-anteprima"
                  >
                    {anteprima.map((r) => (
                      <li
                        key={r.partitaId}
                        className="flex flex-wrap items-baseline gap-x-space-2 [overflow-wrap:anywhere]"
                      >
                        <span className="font-semibold">{r.partita}:</span>
                        <del className="font-mono">
                          <span className="sr-only">prima </span>
                          {r.prima}
                        </del>
                        <span aria-hidden>→</span>
                        <ins className="bg-tape px-space-1 font-mono font-semibold text-primary no-underline">
                          <span className="sr-only">dopo </span>
                          {r.dopo}
                        </ins>
                        {r.sovrascrive ? (
                          <span className="text-sm">
                            (il punteggio salvato si perde: correzione nel
                            registro)
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <h4 className="font-heading font-semibold">
                    Classifica di {girone.nome}
                  </h4>
                  <ol
                    className="flex flex-col gap-space-1"
                    data-testid="ritiro-classifica"
                  >
                    {cambi.map((c) => (
                      <li
                        key={c.iscrizioneId}
                        className="[overflow-wrap:anywhere]"
                      >
                        <span className="font-semibold">{c.nome}</span>
                        {c.iscrizioneId === giocatore
                          ? ` (${tipo === "ritiro" ? "ritirato" : "assente"})`
                          : null}
                        : {descriviCambio(c)},{" "}
                        <span className="font-mono">
                          {c.vinteDopo}/{c.giocateDopo}
                        </span>{" "}
                        vinte
                      </li>
                    ))}
                  </ol>
                </>
              ) : (
                <p className="text-sm">
                  L&apos;anteprima compare quando scegli il giocatore e le
                  partite.
                </p>
              )}
            </section>

            {!online ? (
              <p
                id={`${ids}-offline`}
                className="flex items-start gap-space-2 font-medium"
              >
                <WifiOffIcon aria-hidden className="mt-1 size-4 shrink-0" />
                {RITIRO_MESSAGES.offline}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <DialogClose
              render={
                <Button
                  variant="secondary"
                  size="campo"
                  className="max-w-full"
                  disabled={pending}
                />
              }
            >
              Annulla
            </DialogClose>
            <DialogAction
              type="submit"
              size="campo"
              className="max-w-full"
              disabled={!online}
              aria-describedby={!online ? `${ids}-offline` : undefined}
              loading={pending && sceltaInCorso === null}
              loadingText="Registrazione…"
            >
              {etichettaRegistra(tipo, scelte.length)}
            </DialogAction>
          </DialogFooter>
        </form>
        {/* Inside the dialog (stacked on top) but outside its form: a
            submit in the AlertDialog would bubble to this form. */}
        {state.status === "impatto" ? (
          <ImpattoFase
            open={impattoAperto}
            onOpenChange={setImpattoAperto}
            impatto={state.impatto}
            erroreConferma={state.erroreConferma}
            avviso={state.avviso}
            pending={pending}
            online={online}
            inCorso={pending ? sceltaInCorso : null}
            testi={testiImpattoRitiro(tipo)}
            onScegli={(scelta, conferma) =>
              invia({ scelta, conferma, attesi: state.impatto.punteggiPersi })
            }
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
