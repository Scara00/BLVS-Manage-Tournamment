"use client";

import { useRef, useState, type KeyboardEvent } from "react";
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
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioCard, RadioCardGroup } from "@/components/ui/radio-card";
import {
  nomeDestinazione,
  posizioneGiocatore,
  trovaGiocatore,
} from "@/lib/gironi/editor/operazioni";
import {
  destinazioniSposta,
  operazioneSposta,
  opzioniScambio,
  scambioPredefinito,
  tastoScorciatoia,
  TASTO_NESSUNO_SCAMBIO,
  TASTO_NON_ASSEGNATI,
  type OpzioneDestinazione,
} from "@/lib/gironi/editor/sposta";
import {
  NON_ASSEGNATI,
  type ComposizioneGironi,
  type Destinazione,
  type OperazioneGironi,
} from "@/lib/gironi/editor/types";
import { REGOLA_GIRONI } from "@/lib/tappe/gironi";

/** The visible shortcut key of an option. */
export function Tasto({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-7 items-center justify-center rounded-none border-2 border-primary bg-background px-space-1 font-mono text-sm font-semibold text-primary">
      {children}
    </kbd>
  );
}

function descriviDestinazione(o: OpzioneDestinazione): string {
  if (o.valore === NON_ASSEGNATI) {
    return o.giocatori.length === 0
      ? "Nessun giocatore, per ora."
      : `${o.giocatori.length} in attesa di un girone.`;
  }
  const n = o.giocatori.length;
  const stato = o.pieno ? " · completo: scegli con chi scambiare" : "";
  return `${n} su ${REGOLA_GIRONI.dimensione}${stato}`;
}

type SpostaDialogProps = {
  composizione: ComposizioneGironi;
  open: boolean;
  /** The player to move (kept while the dialog fades out). */
  iscrizioneId: string | null;
  onOpenChange: (open: boolean) => void;
  /** Confirmed: the move or the swap to save. The editor closes the dialog. */
  onConferma: (operazione: OperazioneGironi) => void;
  /** Storybook: starting destination. */
  destinazioneIniziale?: Destinazione;
  /** Bumped at every opening, so each one starts from a fresh state. */
  apertura?: number;
  /** The closing animation is over (focus may move without the trap). */
  onChiuso?: () => void;
};

/**
 * w-admin-sposta, «Sposta nel girone…»: the full keyboard alternative to
 * dragging. Pick a destination (1–9, 0 = «Non assegnati»); if it has
 * players, optionally pick one to swap with (A, B…, X = none). Enter
 * confirms, Esc closes. After a confirm the editor moves focus to the
 * player's «Sposta» button, wherever the player ends up; on cancel focus
 * goes back to it as usual.
 */
export function SpostaDialog({
  composizione,
  open,
  iscrizioneId,
  onOpenChange,
  onConferma,
  destinazioneIniziale,
  apertura = 0,
  onChiuso,
}: SpostaDialogProps) {
  return (
    <Dialog
      open={open && iscrizioneId !== null}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(aperto) => {
        if (!aperto) onChiuso?.();
      }}
    >
      {iscrizioneId !== null ? (
        <SpostaDialogContenuto
          // A fresh state for every opening.
          key={`${iscrizioneId}:${apertura}`}
          composizione={composizione}
          iscrizioneId={iscrizioneId}
          onConferma={onConferma}
          destinazioneIniziale={destinazioneIniziale}
        />
      ) : null}
    </Dialog>
  );
}

function SpostaDialogContenuto({
  composizione: attuale,
  iscrizioneId,
  onConferma,
  destinazioneIniziale,
}: Pick<
  SpostaDialogProps,
  "composizione" | "onConferma" | "destinazioneIniziale"
> & {
  iscrizioneId: string;
}) {
  // Frozen at opening: the groups change (optimistically) while the
  // dialog fades out, and its text must not change under the user.
  const [composizione] = useState(attuale);
  const confermato = useRef(false);
  const giocatore = trovaGiocatore(composizione, iscrizioneId);
  const da = posizioneGiocatore(composizione, iscrizioneId);
  const destinazioni = destinazioniSposta(composizione, iscrizioneId);

  const [verso, setVerso] = useState<Destinazione | null>(
    destinazioneIniziale ?? destinazioni[0]?.valore ?? null,
  );
  const scelta = destinazioni.find((o) => o.valore === verso) ?? null;
  const [scambio, setScambio] = useState<string | null>(
    scelta ? scambioPredefinito(scelta) : null,
  );
  const scambi = scelta ? opzioniScambio(scelta) : [];
  const nomeScambio = scambi.find((s) => s.valore === scambio)?.nome;

  function scegliDestinazione(valore: Destinazione) {
    setVerso(valore);
    const o = destinazioni.find((d) => d.valore === valore);
    setScambio(o ? scambioPredefinito(o) : null);
  }

  function conferma() {
    if (!verso) return;
    confermato.current = true;
    onConferma(operazioneSposta(iscrizioneId, verso, scambio));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Enter") {
      // Enter on a button already activates it.
      if ((event.target as HTMLElement).closest("button")) return;
      event.preventDefault();
      conferma();
      return;
    }
    const scorciatoia = tastoScorciatoia(event.key, destinazioni, scambi);
    if (!scorciatoia) return;
    event.preventDefault();
    if (scorciatoia.tipo === "destinazione") {
      scegliDestinazione(scorciatoia.valore);
    } else {
      setScambio(scorciatoia.valore);
    }
  }

  const azione = scambio
    ? `Scambia con ${nomeScambio}`
    : verso
      ? `Sposta in ${nomeDestinazione(composizione, verso)}`
      : "Sposta";

  return (
    <DialogContent
      data-testid="sposta-dialog"
      onKeyDown={onKeyDown}
      // The editor focuses the moved row after a confirm; on cancel the
      // default (back to «Sposta») applies.
      finalFocus={() => !confermato.current}
    >
      <DialogHeader>
        <DialogTitle>Sposta nel girone…</DialogTitle>
        <DialogDescription>
          <span className="[overflow-wrap:anywhere]">{giocatore?.nome}</span>{" "}
          ora è{" "}
          {da === NON_ASSEGNATI
            ? "tra i non assegnati"
            : `nel ${nomeDestinazione(composizione, da ?? "")}`}
          .
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <div className="flex flex-col gap-stack">
          {destinazioni.length === 0 ? (
            <p>Non ci sono altri gironi: aggiungine uno.</p>
          ) : (
            <RadioCardGroup
              legend="Destinazione"
              value={verso}
              onValueChange={(v) => scegliDestinazione(v as Destinazione)}
            >
              {destinazioni.map((o) => (
                <RadioCard
                  key={o.valore}
                  value={o.valore}
                  title={
                    <span className="flex items-center gap-space-2">
                      {o.tasto ? <Tasto>{o.tasto}</Tasto> : null}
                      <span className="[overflow-wrap:anywhere]">{o.nome}</span>
                    </span>
                  }
                  description={
                    <span className="font-mono">{descriviDestinazione(o)}</span>
                  }
                />
              ))}
            </RadioCardGroup>
          )}
          {scambi.length > 0 ? (
            <RadioCardGroup
              legend="Scambia con…"
              hint={
                scelta?.pieno
                  ? `${scelta.nome} è completo: lo scambio lo tiene a ${REGOLA_GIRONI.dimensione}.`
                  : undefined
              }
              value={scambio}
              onValueChange={(v) => setScambio(v as string | null)}
            >
              {scambi.map((s) => (
                <RadioCard
                  key={s.valore ?? "nessuno"}
                  value={s.valore}
                  title={
                    <span className="flex items-center gap-space-2">
                      <Tasto>{s.tasto}</Tasto>
                      <span className="[overflow-wrap:anywhere]">{s.nome}</span>
                    </span>
                  }
                />
              ))}
            </RadioCardGroup>
          ) : null}
          <div className="text-sm">
            <p className="font-semibold">Scorciatoie da tastiera</p>
            <ul className="mt-space-1 flex flex-col gap-space-1">
              <li>
                <Tasto>1</Tasto>–<Tasto>9</Tasto> sceglie il girone,{" "}
                <Tasto>{TASTO_NON_ASSEGNATI}</Tasto> i non assegnati
              </li>
              <li>
                <Tasto>A</Tasto>, <Tasto>B</Tasto>… sceglie con chi scambiare,{" "}
                <Tasto>{TASTO_NESSUNO_SCAMBIO}</Tasto> nessuno scambio
              </li>
              <li>
                <Tasto>Invio</Tasto> conferma, <Tasto>Esc</Tasto> chiude
              </li>
            </ul>
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <DialogClose
          render={<Button variant="secondary" className="max-w-full" />}
        >
          Annulla
        </DialogClose>
        <DialogAction
          className="max-w-full"
          disabled={!verso}
          onClick={conferma}
        >
          {azione}
        </DialogAction>
      </DialogFooter>
    </DialogContent>
  );
}
