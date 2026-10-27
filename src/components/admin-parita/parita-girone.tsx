"use client";

import { cn } from "cn";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { descriviOrdine, titoloParita } from "@/lib/gironi/parita/format";
import type {
  ParitaGirone as ParitaGironeDati,
  ParitaVista,
  RisolviParitaAction,
  RisolviParitaState,
} from "@/lib/gironi/parita/types";
import { ParitaDialog } from "./parita-dialog";

type ParitaGironeProps = {
  girone: ParitaGironeDati;
  /** Server action `risolviParita` (a fake in Storybook). */
  risolvi: RisolviParitaAction;
  /** Darker frame (w-admin-live) or plain (inside the editor's card). */
  className?: string;
  /** Storybook: open the dialog of the first tie at once. */
  defaultOpen?: boolean;
  initialState?: RisolviParitaState;
  loading?: boolean;
  offline?: boolean;
};

/**
 * The «Parità da risolvere» signal of one finished group and the button
 * that opens w-admin-parita, or a decided tie with «Modifica la decisione».
 * Nothing renders while the group has no perfect tie. After a decision the
 * new order is announced as text and receives focus.
 */
export function ParitaGirone({
  girone,
  risolvi,
  className,
  defaultOpen = false,
  initialState,
  loading,
  offline,
}: ParitaGironeProps) {
  const [aperta, setAperta] = useState<{
    vista: ParitaVista;
    n: number;
  } | null>(
    defaultOpen && girone.parita[0] ? { vista: girone.parita[0], n: 0 } : null,
  );
  const [open, setOpen] = useState(defaultOpen && girone.parita.length > 0);
  const [aperture, setAperture] = useState(0);
  const [fine, setFine] = useState<string | null>(null);
  const [riuscita, setRiuscita] = useState(false);
  const fineRef = useRef<HTMLParagraphElement>(null);

  const onRiuscita = useCallback((message: string) => {
    setRiuscita(true);
    setFine(message);
    setOpen(false);
  }, []);

  // Focus the announcement once the dialog is closed (finalFocus covers
  // the animation; this covers a refresh that remounts the trigger).
  useEffect(() => {
    if (!riuscita || open) return;
    const p = fineRef.current;
    if (!p) return;
    p.focus({ preventScroll: true });
    p.scrollIntoView?.({ block: "nearest" });
  }, [riuscita, open]);

  if (girone.parita.length === 0 && !fine) return null;

  function apri(vista: ParitaVista) {
    // The dialog keeps this copy while it is open: a refresh() after the
    // save does not change its content mid-animation.
    setAperta({ vista, n: aperture + 1 });
    setAperture((n) => n + 1);
    setRiuscita(false);
    setFine(null);
    setOpen(true);
  }

  return (
    <div
      data-testid="parita-girone"
      data-girone={girone.gironeId}
      className={cn("flex flex-col gap-space-3", className)}
    >
      {girone.parita.map((p) => {
        const nomi = p.giocatori.map((g) => g.nome);
        return (
          <div
            key={p.firma}
            data-testid="parita-voce"
            data-decisa={p.decisione ? "" : undefined}
            className="flex flex-col items-start gap-space-2"
          >
            {p.decisione ? (
              <p className="font-semibold [overflow-wrap:anywhere]">
                {titoloParita(p.posizione, p.giocatori.length)}: decisa
                dall&apos;organizzazione
                <span className="block text-sm font-normal">
                  {descriviOrdine(p.posizione, nomi)} · {p.decisione.motivo}
                </span>
              </p>
            ) : (
              <>
                <Badge variant="tape">Parità da risolvere</Badge>
                <p className="[overflow-wrap:anywhere]">
                  {titoloParita(p.posizione, p.giocatori.length)}:{" "}
                  {nomi.join(", ")}.
                </p>
              </>
            )}
            <Button
              variant={p.decisione ? "secondary" : "primary"}
              size="campo"
              className="max-w-full"
              aria-label={`${p.decisione ? "Modifica la decisione" : "Risolvi la parità"} del ${girone.gironeNome}`}
              onClick={() => apri(p)}
            >
              {p.decisione ? "Modifica la decisione" : "Risolvi la parità"}
            </Button>
          </div>
        );
      })}

      {aperta ? (
        <ParitaDialog
          key={`${aperta.vista.firma}:${aperta.n}`}
          girone={girone}
          parita={aperta.vista}
          risolvi={risolvi}
          open={open}
          onOpenChange={setOpen}
          onRiuscita={onRiuscita}
          finalFocus={() => (riuscita ? fineRef.current : true)}
          initialState={initialState}
          loading={loading}
          offline={offline}
        />
      ) : null}

      <p
        ref={fineRef}
        tabIndex={-1}
        role="status"
        data-testid="parita-esito"
        className={
          fine
            ? "self-stretch border-l-4 border-tape p-space-2 font-semibold [overflow-wrap:anywhere] focus-ring"
            : "sr-only"
        }
      >
        {fine}
      </p>
    </div>
  );
}
