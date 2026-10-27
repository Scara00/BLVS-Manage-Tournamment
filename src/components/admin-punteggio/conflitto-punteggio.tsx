"use client";

import { AlertTriangleIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Tape } from "@/components/scoreboard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type CifraConfronto,
  confrontaPunteggi,
  descriviDifferenze,
  formatSets,
  introConflitto,
  leggiSets,
  type NomiCoppie,
  type PunteggioUfficiale,
  type SetConfronto,
  type SetConflitto,
} from "@/lib/punteggi/conflitto/rileva";

type Passo = "scelta" | "conferma";

/** Wording of the dialog; BLVS-37 reuses it for the partial. */
export type TestiConflitto = {
  titolo: string;
  titoloConferma: string;
  /** The intro of the choice step, from the saved value. */
  intro: (salvato: PunteggioUfficiale) => string;
  /** The confirmation text, from the two values already formatted. */
  conferma: (salvato: string, mio: string) => string;
  etichettaSalvato: string;
  badgeSalvato: string;
  tieni: string;
};

const TESTI_PUNTEGGIO: TestiConflitto = {
  titolo: "Il punteggio è cambiato",
  titoloConferma: "Sovrascrivere il punteggio ufficiale?",
  intro: (salvato) =>
    `${introConflitto(salvato)} Il tuo punteggio non è stato salvato: scegli quale tenere.`,
  conferma: (salvato, mio) =>
    `Il punteggio salvato ${salvato} viene sostituito dal tuo ${mio}. Il valore precedente resta nel registro.`,
  etichettaSalvato: "Salvato",
  badgeSalvato: "Ufficiale",
  tieni: "Tieni il salvato",
};

type ConflittoPunteggioProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The score saved meanwhile by another admin: the official one. */
  salvato: PunteggioUfficiale;
  /** The score this admin tried to save. */
  mio: SetConflitto[];
  coppie: NomiCoppie;
  /** «Tieni il salvato»: the form takes the official value. */
  onTieniSalvato: () => void;
  /** «Sì, sovrascrivi»: save again over `versione`, the one shown here. */
  onSovrascrivi: (versione: number) => void;
  /** The overwrite is in flight. */
  pending?: boolean;
  /** Where focus goes when the dialog closes (default: the trigger). */
  finalFocus?: React.ComponentProps<typeof AlertDialogContent>["finalFocus"];
  /** Storybook: start at the overwrite confirmation. */
  defaultPasso?: Passo;
  /** Overrides the wording (the partial, BLVS-37). */
  testi?: Partial<TestiConflitto>;
};

function Cifra({ cifra }: { cifra: CifraConfronto }) {
  return cifra.diverso ? (
    <span
      data-diverso=""
      className="bg-tape px-[0.15em] font-bold text-primary underline decoration-[3px] underline-offset-4"
    >
      {cifra.valore}
    </span>
  ) : (
    <span>{cifra.valore}</span>
  );
}

/**
 * One version on one line: never wraps (390px), digits that differ from the
 * other version are underlined on tape, so they do not rely on colour.
 */
function RigaPunteggio({
  id,
  etichetta,
  ufficiale,
  badge,
  sets,
  lato,
  confronto,
}: {
  id: string;
  etichetta: string;
  ufficiale?: boolean;
  badge?: string;
  sets: SetConflitto[];
  lato: "salvato" | "mio";
  confronto: SetConfronto[];
}) {
  const presenti = confronto.flatMap((set) => {
    const valori = set[lato];
    return valori ? [{ numero: set.numero, ...valori }] : [];
  });
  return (
    <div
      role="group"
      aria-labelledby={id}
      data-testid={`conflitto-${lato}`}
      className={
        ufficiale
          ? "flex flex-col gap-space-2 border-l-4 border-tape bg-background p-space-3"
          : "flex flex-col gap-space-2 border-l-4 border-border bg-background p-space-3"
      }
    >
      <h3
        id={id}
        className="flex flex-wrap items-center gap-space-2 font-heading font-semibold [overflow-wrap:anywhere]"
      >
        {etichetta}
        {ufficiale ? <Badge variant="tape">{badge}</Badge> : null}
      </h3>
      <p className="font-mono text-xl font-semibold whitespace-nowrap text-primary tabular-nums">
        <span className="sr-only">{leggiSets(sets)}</span>
        <span aria-hidden data-slot="punteggio">
          {presenti.length === 0
            ? "—"
            : presenti.map((set, i) => (
                <span key={set.numero}>
                  {i > 0 ? <span className="px-[0.5ch]">·</span> : null}
                  <Cifra cifra={set.a} />-<Cifra cifra={set.b} />
                </span>
              ))}
        </span>
      </p>
    </div>
  );
}

/**
 * w-admin-conflitto: the save found a newer version of the score. Shows the
 * saved (official) value and the admin's own, with the differing digits
 * marked by underline and listed in words. «Tieni il salvato» is the safe
 * choice and has focus; «Sovrascrivi» asks for a second confirmation and
 * only overwrites the version shown here.
 */
export function ConflittoPunteggio({
  open,
  onOpenChange,
  salvato,
  mio,
  coppie,
  onTieniSalvato,
  onSovrascrivi,
  pending = false,
  finalFocus,
  defaultPasso = "scelta",
  testi: testiParziali,
}: ConflittoPunteggioProps) {
  const testi = { ...TESTI_PUNTEGGIO, ...testiParziali };
  const salvatoId = useId();
  const mioId = useId();
  const [passo, setPasso] = useState<Passo>(defaultPasso);
  const sovrascriviRef = useRef<HTMLButtonElement>(null);
  const annullaRef = useRef<HTMLButtonElement>(null);
  /** Set by a step change, so focus moves only then (not on open). */
  const [spostaFocus, setSpostaFocus] = useState<Passo | null>(null);

  // A fresh conflict (another save meanwhile) starts again from the choice.
  const [versioneVista, setVersioneVista] = useState(salvato.versione);
  if (salvato.versione !== versioneVista) {
    setVersioneVista(salvato.versione);
    setPasso("scelta");
  }

  useEffect(() => {
    if (spostaFocus === "conferma") annullaRef.current?.focus();
    if (spostaFocus === "scelta") sovrascriviRef.current?.focus();
  }, [spostaFocus]);

  const confronto = confrontaPunteggi(salvato.sets, mio);
  const differenze = descriviDifferenze(confronto, coppie);

  function vaiA(next: Passo) {
    setPasso(next);
    setSpostaFocus(next);
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (next) {
          setPasso(defaultPasso);
          setSpostaFocus(null);
        }
        onOpenChange(next);
      }}
    >
      <AlertDialogContent
        className="max-w-xl"
        data-testid="conflitto-punteggio"
        finalFocus={finalFocus}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {passo === "scelta" ? testi.titolo : testi.titoloConferma}
          </AlertDialogTitle>
          <AlertDialogDescription className="[overflow-wrap:anywhere]">
            {passo === "scelta"
              ? testi.intro(salvato)
              : testi.conferma(formatSets(salvato.sets), formatSets(mio))}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogBody className="flex flex-col gap-stack-sm">
          <Tape size={8} />
          <p className="text-sm [overflow-wrap:anywhere]">
            <span className="font-semibold">Coppie:</span> {coppie.a}{" "}
            <span className="text-muted-foreground">contro</span> {coppie.b}
          </p>
          <div className="flex flex-col gap-space-3">
            <RigaPunteggio
              id={salvatoId}
              etichetta={testi.etichettaSalvato}
              ufficiale
              badge={testi.badgeSalvato}
              sets={salvato.sets}
              lato="salvato"
              confronto={confronto}
            />
            <RigaPunteggio
              id={mioId}
              etichetta="Il tuo"
              sets={mio}
              lato="mio"
              confronto={confronto}
            />
          </div>
          {differenze.length > 0 ? (
            <div className="flex flex-col gap-space-1">
              <p className="flex items-start gap-space-2 font-semibold">
                <AlertTriangleIcon
                  aria-hidden
                  className="mt-1 size-4 shrink-0"
                />
                Cifre diverse (sottolineate):
              </p>
              <ul
                data-testid="conflitto-differenze"
                className="flex list-disc flex-col gap-space-1 pl-space-5 [overflow-wrap:anywhere]"
              >
                {differenze.map((riga) => (
                  <li key={riga}>{riga}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p>I due punteggi coincidono.</p>
          )}
        </AlertDialogBody>
        <AlertDialogFooter>
          {passo === "scelta" ? (
            <>
              <Button
                ref={sovrascriviRef}
                variant="secondary"
                className="max-w-full"
                onClick={() => vaiA("conferma")}
              >
                Sovrascrivi
              </Button>
              <AlertDialogCancel
                variant="primary"
                className="max-w-full"
                onClick={onTieniSalvato}
              >
                {testi.tieni}
              </AlertDialogCancel>
            </>
          ) : (
            <>
              <Button
                ref={annullaRef}
                variant="secondary"
                className="max-w-full"
                disabled={pending}
                focusableWhenDisabled
                onClick={() => vaiA("scelta")}
              >
                Annulla
              </Button>
              <AlertDialogAction
                tone="destructive"
                className="max-w-full"
                loading={pending}
                loadingText="Salvataggio…"
                onClick={() => onSovrascrivi(salvato.versione)}
              >
                Sì, sovrascrivi
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export type { ConflittoPunteggioProps };
