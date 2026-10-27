"use client";

import { cn } from "cn";
import { ArrowRightLeftIcon, GripVerticalIcon, Trash2Icon } from "lucide-react";
import { useState, type DragEvent, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  NON_ASSEGNATI,
  type Destinazione,
  type GiocatoreGirone,
  type GironeEditor,
} from "@/lib/gironi/editor/types";
import { REGOLA_GIRONI } from "@/lib/tappe/gironi";
import { FaseMarker } from "./legenda-fasi";

/** MIME type of a dragged player: its `iscrizioneId`. */
export const TIPO_TRASCINAMENTO = "application/x-blvs-iscrizione";

export type DragHandlers = {
  /** Editing allowed (no group match started). */
  modificabile: boolean;
  /** The player being dragged, if any. */
  trascinato: string | null;
  onDragStart: (iscrizioneId: string) => void;
  onDragEnd: () => void;
  /** Dropped on a player: swap. */
  onDropSuGiocatore: (iscrizioneId: string) => void;
  /** Dropped on a list (not on a player): move there. */
  onDropSuLista: (verso: Destinazione) => void;
  onSposta: (iscrizioneId: string) => void;
};

function accetta(event: DragEvent) {
  return event.dataTransfer.types.includes(TIPO_TRASCINAMENTO);
}

/**
 * One player: a 48 px row with the full name (it wraps, never truncated),
 * a drag grip and «Sposta», a 48 px icon button that opens the keyboard
 * dialog. Dropping another player on the row swaps the two.
 */
export function GiocatoreRiga({
  giocatore,
  drag,
}: {
  giocatore: GiocatoreGirone;
  drag: DragHandlers;
}) {
  const [sopra, setSopra] = useState(false);
  const { iscrizioneId, nome } = giocatore;
  const altro = drag.trascinato !== null && drag.trascinato !== iscrizioneId;

  return (
    <li
      data-testid="giocatore-riga"
      data-iscrizione={iscrizioneId}
      data-drop={sopra || undefined}
      draggable={drag.modificabile}
      onDragStart={(event) => {
        event.dataTransfer.setData(TIPO_TRASCINAMENTO, iscrizioneId);
        event.dataTransfer.effectAllowed = "move";
        drag.onDragStart(iscrizioneId);
      }}
      onDragEnd={() => drag.onDragEnd()}
      onDragOver={(event) => {
        if (!altro || !accetta(event)) return;
        event.preventDefault();
        event.stopPropagation();
        setSopra(true);
      }}
      onDragLeave={() => setSopra(false)}
      onDrop={(event) => {
        if (!altro || !accetta(event)) return;
        event.preventDefault();
        event.stopPropagation();
        setSopra(false);
        drag.onDropSuGiocatore(iscrizioneId);
      }}
      className={cn(
        "flex min-h-12 items-center gap-space-2 border-b border-neutral-200 bg-background py-space-1 ps-space-2 last:border-b-0",
        drag.modificabile && "cursor-grab active:cursor-grabbing",
        drag.trascinato === iscrizioneId && "opacity-60",
        sopra && "bg-tape-soft shadow-[inset_0_0_0_2px_var(--color-primary)]",
      )}
    >
      {drag.modificabile ? (
        <GripVerticalIcon
          aria-hidden
          className="size-5 shrink-0 text-muted-foreground"
        />
      ) : null}
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{nome}</span>
      {drag.modificabile ? (
        <Button
          variant="secondary"
          size="icon-campo"
          data-sposta={iscrizioneId}
          aria-label={`Sposta ${nome}`}
          title="Sposta nel girone…"
          className="border-transparent"
          onClick={() => drag.onSposta(iscrizioneId)}
        >
          <ArrowRightLeftIcon aria-hidden />
        </Button>
      ) : null}
    </li>
  );
}

/** The players of a group (or «Non assegnati»). */
export function ListaGiocatori({
  giocatori,
  vuoto,
  etichetta,
  drag,
}: {
  giocatori: readonly GiocatoreGirone[];
  vuoto: string;
  etichetta: string;
  drag: DragHandlers;
}) {
  return (
    <div className="flex min-h-24 flex-1 flex-col">
      {giocatori.length === 0 ? (
        <p className="p-inset text-sm text-muted-foreground">{vuoto}</p>
      ) : (
        <ul aria-label={etichetta}>
          {giocatori.map((g) => (
            <GiocatoreRiga key={g.iscrizioneId} giocatore={g} drag={drag} />
          ))}
        </ul>
      )}
    </div>
  );
}

function statoMisura(n: number, dimensione: number): string | null {
  if (n === dimensione) return null;
  if (n < dimensione) {
    const mancano = dimensione - n;
    return mancano === 1 ? "Manca 1 giocatore" : `Mancano ${mancano} giocatori`;
  }
  const troppi = n - dimensione;
  return troppi === 1
    ? "1 giocatore di troppo"
    : `${troppi} giocatori di troppo`;
}

function EliminaGirone({
  girone,
  onElimina,
}: {
  girone: GironeEditor;
  onElimina: () => void;
}) {
  const [open, setOpen] = useState(false);
  const n = girone.giocatori.length;
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        variant="secondary"
        className="max-w-full"
        onClick={() => setOpen(true)}
        // The visible «Elimina girone» stays in the name (gold/silver groups
        // are called «Gold A», «Silver A»: BLVS-39).
        aria-label={
          girone.nome.startsWith("Girone")
            ? `Elimina ${girone.nome}`
            : `Elimina girone ${girone.nome}`
        }
      >
        <Trash2Icon aria-hidden />
        Elimina girone
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminare il {girone.nome}?</AlertDialogTitle>
          <AlertDialogDescription>
            {n === 0
              ? "Il girone è vuoto."
              : n === 1
                ? "Il suo giocatore passa tra i non assegnati."
                : `I suoi ${n} giocatori passano tra i non assegnati.`}{" "}
            Le partite programmate del girone vengono eliminate.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="max-w-full">Annulla</AlertDialogCancel>
          <AlertDialogAction
            tone="destructive"
            className="max-w-full"
            onClick={() => {
              setOpen(false);
              onElimina();
            }}
          >
            Elimina {girone.nome}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * A frame shared by groups and «Non assegnati». The whole frame is the
 * drop zone: dropping on it (not on a player row) moves the player here.
 */
function Riquadro({
  id,
  destinazione,
  drag,
  intestazione,
  avviso,
  children,
  piede,
  testId,
  scuro,
}: {
  id: string;
  destinazione: Destinazione;
  drag: DragHandlers;
  intestazione: ReactNode;
  avviso?: string | null;
  children: ReactNode;
  piede?: ReactNode;
  testId: string;
  scuro: boolean;
}) {
  const [sopra, setSopra] = useState(false);
  const attivo = drag.trascinato !== null;
  return (
    <section
      aria-labelledby={id}
      data-testid={testId}
      data-drop={sopra || undefined}
      onDragOver={(event) => {
        if (!attivo || !accetta(event)) return;
        event.preventDefault();
        setSopra(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setSopra(false);
        }
      }}
      onDrop={(event) => {
        if (!attivo || !accetta(event)) return;
        event.preventDefault();
        setSopra(false);
        drag.onDropSuLista(destinazione);
      }}
      className={cn(
        "flex min-w-0 flex-col rounded-none border-2 border-primary bg-background",
        sopra && "outline-4 outline-offset-2 outline-tape-strong",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-space-2 px-space-3 py-space-2",
          scuro ? "bg-primary text-primary-foreground" : "bg-background",
          !scuro && "border-b-2 border-primary",
        )}
      >
        {intestazione}
      </div>
      {avviso ? (
        <p className="bg-tape px-space-3 py-space-1 text-sm font-semibold text-primary">
          {avviso}
        </p>
      ) : null}
      {children}
      {piede ? (
        <div className="border-t border-neutral-200 p-space-2">{piede}</div>
      ) : null}
    </section>
  );
}

function Titolo({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={`girone-${id}`}
      data-girone-titolo={id}
      tabIndex={-1}
      className="min-w-0 flex-1 font-heading text-lg font-semibold [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground"
    >
      {children}
    </h2>
  );
}

/** One group: black header with Gold/Silver mark and «3/4» counter. */
export function GironeCard({
  girone,
  drag,
  onElimina,
}: {
  girone: GironeEditor;
  drag: DragHandlers;
  onElimina: () => void;
}) {
  const { dimensione } = REGOLA_GIRONI;
  const n = girone.giocatori.length;
  return (
    <Riquadro
      id={`girone-${girone.id}`}
      destinazione={girone.id}
      drag={drag}
      testId="girone-card"
      scuro
      intestazione={
        <>
          {girone.fase ? <FaseMarker fase={girone.fase} /> : null}
          <Titolo id={girone.id}>{girone.nome}</Titolo>
          <span className="shrink-0 font-mono text-lg font-semibold tabular-nums">
            {n}/{dimensione}
            <span className="sr-only"> giocatori</span>
          </span>
        </>
      }
      avviso={statoMisura(n, dimensione)}
      piede={
        drag.modificabile ? (
          <EliminaGirone girone={girone} onElimina={onElimina} />
        ) : null
      }
    >
      <ListaGiocatori
        giocatori={girone.giocatori}
        etichetta={`Giocatori del ${girone.nome}`}
        vuoto={
          drag.modificabile
            ? "Nessun giocatore. Trascinane uno qui o usa «Sposta»."
            : "Nessun giocatore."
        }
        drag={drag}
      />
    </Riquadro>
  );
}

/** Confirmed players in no group. */
export function NonAssegnatiCard({
  giocatori,
  drag,
}: {
  giocatori: readonly GiocatoreGirone[];
  drag: DragHandlers;
}) {
  return (
    <Riquadro
      id="girone-non-assegnati"
      destinazione={NON_ASSEGNATI}
      drag={drag}
      testId="non-assegnati"
      scuro={false}
      intestazione={
        <>
          <Titolo id="non-assegnati">Non assegnati</Titolo>
          <span className="shrink-0 font-mono text-lg font-semibold tabular-nums">
            {giocatori.length}
            <span className="sr-only"> giocatori</span>
          </span>
        </>
      }
    >
      <ListaGiocatori
        giocatori={giocatori}
        etichetta="Giocatori non assegnati"
        vuoto="Tutti i giocatori sono in un girone."
        drag={drag}
      />
    </Riquadro>
  );
}
