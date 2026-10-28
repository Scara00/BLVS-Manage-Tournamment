"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { AlertCircleIcon, Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import {
  etichettaScorciatoia,
  isScorciatoiaPalette,
  prossimoAttivo,
} from "@/lib/admin/palette/navigazione";
import {
  annuncioRisultati,
  cercaComandi,
  idOpzione,
  opzioni,
  raggruppa,
} from "@/lib/admin/palette/ricerca";
import type {
  CercaPaletteAction,
  EsitoPalette,
  GruppoPalette,
  RisultatoPalette,
} from "@/lib/admin/palette/types";
import { RICERCA_MIN_CARATTERI } from "@/lib/iscrizioni/admin/messages";
import { paroleRicerca } from "@/lib/iscrizioni/admin/search";
import { cn } from "@/lib/utils";

/** Pause after the last keystroke before the search runs. */
export const PALETTE_DEBOUNCE_MS = 200;

export type RicercaPalette =
  | { stato: "vuota" }
  | { stato: "corta" }
  | { stato: "inCorso" }
  | { stato: "esito"; esito: EsitoPalette };

const RICERCA_VUOTA: RicercaPalette = { stato: "vuota" };

const ERRORE_RETE: EsitoPalette = {
  status: "error",
  reason: "network",
  message: "Ricerca non riuscita. Riprova tra qualche secondo.",
};

function paroleComandi(query: string): string[] {
  const testo = query.trim();
  return testo ? testo.split(/\s+/).slice(0, 4) : [];
}

/** The groups on screen: entity results (once found) plus the commands. */
export function gruppiPalette(
  query: string,
  ricerca: RicercaPalette,
): GruppoPalette[] {
  const esito =
    ricerca.stato === "esito" && ricerca.esito.status === "ok"
      ? ricerca.esito
      : null;
  return raggruppa({
    tappa: esito?.tappe,
    giocatore: esito?.giocatori,
    partita: esito?.partite,
    comando: cercaComandi(paroleComandi(query)),
  });
}

function testoStato(
  query: string,
  ricerca: RicercaPalette,
  totale: number,
): string {
  switch (ricerca.stato) {
    case "vuota":
      return "";
    case "corta":
      return `Scrivi almeno ${RICERCA_MIN_CARATTERI} caratteri.`;
    case "inCorso":
      return "Ricerca in corso…";
    case "esito":
      if (ricerca.esito.status === "error") return ricerca.esito.message;
      return `${annuncioRisultati(totale)} per «${query.trim()}».`;
  }
}

const subscribeNulla = () => () => {};

function piattaforma(): string {
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  return nav.userAgentData?.platform || nav.platform || "";
}

/** «⌘ K» on Apple devices, «Ctrl K» elsewhere (and on the server). */
function useEtichettaScorciatoia(): string {
  return useSyncExternalStore(
    subscribeNulla,
    () => etichettaScorciatoia(piattaforma()),
    () => etichettaScorciatoia(""),
  );
}

/**
 * The height left by the on-screen keyboard (visualViewport), so the
 * palette is never hidden behind it on touch devices.
 */
function useAltezzaVisibile(attivo: boolean): number | null {
  const [altezza, setAltezza] = useState<number | null>(null);
  useEffect(() => {
    const vv =
      typeof window === "undefined" ? undefined : window.visualViewport;
    if (!attivo || !vv) return;
    const update = () => setAltezza(vv.height);
    update();
    vv.addEventListener("resize", update);
    return () => vv.removeEventListener("resize", update);
  }, [attivo]);
  return attivo ? altezza : null;
}

/**
 * Whether the results area overflows: only then is it a tab stop, so it
 * can be scrolled from the keyboard (WCAG 2.1.1) without an extra stop.
 */
function useScorrevole() {
  const [scorrevole, setScorrevole] = useState(false);
  const misura = useCallback((node: HTMLDivElement | null) => {
    if (!node || typeof ResizeObserver === "undefined") return;
    const update = () =>
      setScorrevole(node.scrollHeight > node.clientHeight + 1);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    for (const child of Array.from(node.children)) observer.observe(child);
    return () => observer.disconnect();
  }, []);
  return [misura, scorrevole] as const;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-6 items-center justify-center border border-current px-space-1 font-mono text-xs font-semibold">
      {children}
    </kbd>
  );
}

type PaletteComandiProps = {
  /** The `cercaPalette` server action (a fake in Storybook and tests). */
  cerca: CercaPaletteAction;
  /** Storybook: open on mount, with a query and its result. */
  defaultOpen?: boolean;
  initialQuery?: string;
  initialRicerca?: RicercaPalette;
};

/**
 * w-admin-palette: Ctrl/Cmd+K (or «Cerca» in the Topbar, the only way on
 * touch) opens a modal ARIA 1.2 combobox that finds stages, players and
 * matches, plus the admin commands. Arrows move the active option
 * (aria-activedescendant, focus stays in the field), Enter opens it, Esc
 * closes and gives focus back to where it was. The key hints show only
 * with a fine pointer. The popup sits above every fixed bar (topbar,
 * toasts) and within the height the on-screen keyboard leaves.
 */
export function PaletteComandi({
  cerca,
  defaultOpen = false,
  initialQuery = "",
  initialRicerca = RICERCA_VUOTA,
}: PaletteComandiProps) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState(initialQuery);
  const [ricerca, setRicerca] = useState<RicercaPalette>(initialRicerca);
  const [attivo, setAttivo] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const richiesta = useRef(0);
  const ritorno = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prefisso = useId().replace(/:/g, "");
  const listboxId = `${prefisso}-risultati`;
  const statoId = `${prefisso}-stato`;
  const aiutoId = `${prefisso}-aiuto`;
  const scorciatoia = useEtichettaScorciatoia();
  const altezza = useAltezzaVisibile(open);
  const [misuraCorpo, corpoScorrevole] = useScorrevole();

  const gruppi = gruppiPalette(query, ricerca);
  const lista = opzioni(gruppi);
  const attiva =
    attivo !== null && attivo < lista.length ? lista[attivo] : null;
  const errore =
    ricerca.stato === "esito" && ricerca.esito.status === "error"
      ? ricerca.esito
      : null;
  const vuoto =
    ricerca.stato === "esito" &&
    ricerca.esito.status === "ok" &&
    lista.length === 0;

  const apri = useCallback(
    (prossimo: boolean) => {
      if (prossimo) {
        // Every opening starts from an empty search.
        if (timer.current) clearTimeout(timer.current);
        richiesta.current += 1;
        setQuery(initialQuery);
        setRicerca(initialRicerca);
        setAttivo(null);
      }
      setOpen(prossimo);
    },
    [initialQuery, initialRicerca],
  );

  // Ctrl/Cmd+K anywhere in the admin area opens (or closes) the palette.
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (!isScorciatoiaPalette(event)) return;
      event.preventDefault();
      if (open) {
        apri(false);
        return;
      }
      const corrente = document.activeElement;
      ritorno.current =
        corrente instanceof HTMLElement && corrente !== document.body
          ? corrente
          : null;
      apri(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, apri]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Keep the active option in view while the arrows move through a long list.
  const idAttiva = attiva ? idOpzione(prefisso, attiva) : undefined;
  useEffect(() => {
    if (!idAttiva) return;
    const el = document.getElementById(idAttiva);
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [idAttiva]);

  const esegui = useCallback(
    (valore: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      const id = ++richiesta.current;
      cerca(valore)
        .catch((): EsitoPalette => ERRORE_RETE)
        .then((esito) => {
          // Only the latest query counts: a slow answer never overwrites it.
          if (id === richiesta.current) setRicerca({ stato: "esito", esito });
        });
    },
    [cerca],
  );

  function onQuery(valore: string) {
    setQuery(valore);
    setAttivo(null);
    if (timer.current) clearTimeout(timer.current);
    richiesta.current += 1;
    if (valore.trim() === "") {
      setRicerca({ stato: "vuota" });
      return;
    }
    if (paroleRicerca(valore).length === 0) {
      timer.current = setTimeout(
        () => setRicerca({ stato: "corta" }),
        PALETTE_DEBOUNCE_MS,
      );
      return;
    }
    setRicerca({ stato: "inCorso" });
    timer.current = setTimeout(() => esegui(valore), PALETTE_DEBOUNCE_MS);
  }

  function scegli(risultato: RisultatoPalette) {
    // Focus goes back to the page, not to the old element.
    ritorno.current = null;
    setOpen(false);
    router.push(risultato.href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      ((event.key === "Home" || event.key === "End") && attivo !== null)
    ) {
      event.preventDefault();
      setAttivo((a) => prossimoAttivo(lista.length, a, event.key));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (attiva) scegli(attiva);
    }
  }

  const stato = testoStato(query, ricerca, lista.length);

  return (
    <Dialog open={open} onOpenChange={apri}>
      <DialogPrimitive.Trigger
        aria-keyshortcuts="Control+K Meta+K"
        data-testid="palette-apri"
        className="inline-flex min-h-12 items-center gap-space-2 border border-primary-foreground px-space-4 py-space-2 font-heading font-medium text-primary-foreground transition-colors hover:bg-primary-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground"
      >
        <SearchIcon aria-hidden className="size-4 shrink-0" />
        {/* md–lg: icon only, the bar has no room at 200% text. */}
        <span className="md:max-lg:sr-only">Cerca</span>
        <span className="sr-only"> tappe, giocatori e partite</span>
        <span
          aria-hidden
          data-slot="palette-scorciatoia"
          className="hidden bg-tape px-space-2 font-mono text-xs font-semibold text-primary md:max-lg:hidden pointer-fine:inline"
        >
          {scorciatoia}
        </span>
      </DialogPrimitive.Trigger>
      <DialogPortal>
        <DialogOverlay className="z-[70]" />
        <DialogPrimitive.Popup
          data-slot="palette"
          initialFocus={inputRef}
          finalFocus={() =>
            ritorno.current?.isConnected ? ritorno.current : true
          }
          style={
            altezza
              ? ({ "--palette-vh": `${altezza}px` } as React.CSSProperties)
              : undefined
          }
          className="fixed top-space-4 left-1/2 z-[70] flex max-h-[calc(var(--palette-vh,100dvh)-2*var(--spacing-space-4))] w-[calc(100vw-2*var(--spacing-space-4))] max-w-2xl -translate-x-1/2 flex-col overflow-hidden border border-border bg-popover text-base text-popover-foreground shadow-lg duration-150 outline-none motion-reduce:animate-none sm:top-[12vh] sm:max-h-[calc(var(--palette-vh,100dvh)-12vh-var(--spacing-space-4))] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        >
          <div className="flex shrink-0 flex-col gap-space-2 border-b border-border p-inset">
            <div className="flex items-start justify-between gap-space-3">
              <DialogPrimitive.Title className="font-heading text-xl font-semibold break-words">
                <label htmlFor={`${prefisso}-campo`}>
                  Cerca tappe, giocatori e partite
                </label>
              </DialogPrimitive.Title>
              <DialogPrimitive.Close className="-mt-space-2 -mr-space-2 inline-flex size-12 shrink-0 items-center justify-center border border-transparent hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                <XIcon aria-hidden className="size-5" />
                <span className="sr-only">Chiudi</span>
              </DialogPrimitive.Close>
            </div>
            <div className="relative">
              <SearchIcon
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-space-3 size-5 -translate-y-1/2 text-muted-foreground"
              />
              <input
                ref={inputRef}
                id={`${prefisso}-campo`}
                type="text"
                role="combobox"
                aria-expanded={lista.length > 0}
                aria-controls={lista.length > 0 ? listboxId : undefined}
                aria-activedescendant={idAttiva}
                aria-autocomplete="list"
                aria-describedby={`${aiutoId} ${statoId}`}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="go"
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                onKeyDown={onKeyDown}
                className="min-h-12 w-full min-w-0 rounded-none border-2 border-input bg-background py-space-2 pr-space-3 pl-10 text-lg text-foreground focus-ring placeholder:text-muted-foreground"
                placeholder="Jesolo, Rossi, Girone A…"
              />
            </div>
            <p id={aiutoId} className="text-sm text-muted-foreground">
              Nome della tappa, del giocatore o del girone.
            </p>
          </div>

          <div
            ref={misuraCorpo}
            role={corpoScorrevole ? "region" : undefined}
            aria-label={corpoScorrevole ? "Risultati della ricerca" : undefined}
            tabIndex={corpoScorrevole ? 0 : undefined}
            className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          >
            <p
              id={statoId}
              role="status"
              data-testid="palette-stato"
              className={cn(
                "flex items-center gap-space-2 px-inset font-medium",
                stato ? "min-h-12 py-space-2" : "sr-only",
              )}
            >
              {ricerca.stato === "inCorso" ? (
                <Loader2Icon
                  aria-hidden
                  className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
                />
              ) : null}
              {stato}
            </p>

            {errore ? (
              <p
                role="alert"
                className="mx-inset mb-space-3 flex items-start gap-space-2 border-2 border-error-fg bg-error-bg p-inset font-semibold text-error-fg"
              >
                <AlertCircleIcon aria-hidden className="mt-1 size-4 shrink-0" />
                {errore.message}
              </p>
            ) : null}

            {vuoto ? (
              <div
                data-testid="palette-vuota"
                className="mx-inset mb-space-3 border border-dashed border-input p-inset-lg text-center"
              >
                <p className="font-heading font-semibold">
                  Nessun risultato per «{query.trim()}»
                </p>
                <p className="text-sm text-muted-foreground">
                  Prova con il cognome, il nome della tappa o del girone.
                </p>
              </div>
            ) : null}

            {lista.length > 0 ? (
              <div
                id={listboxId}
                role="listbox"
                aria-label="Risultati"
                aria-busy={ricerca.stato === "inCorso" || undefined}
                className="flex flex-col pb-space-2"
              >
                {gruppi.map((gruppo) => {
                  const headingId = `${prefisso}-gruppo-${gruppo.tipo}`;
                  return (
                    <div
                      key={gruppo.tipo}
                      role="group"
                      aria-labelledby={headingId}
                      data-gruppo={gruppo.tipo}
                    >
                      <span
                        id={headingId}
                        className="block px-inset pt-space-3 pb-space-1 font-mono text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                      >
                        {gruppo.etichetta}
                      </span>
                      {gruppo.risultati.map((risultato) => {
                        const indice = lista.indexOf(risultato);
                        const selezionata = attiva === risultato;
                        return (
                          <div
                            key={risultato.id}
                            id={idOpzione(prefisso, risultato)}
                            role="option"
                            aria-selected={selezionata}
                            data-active={selezionata || undefined}
                            data-href={risultato.href}
                            onMouseDown={(e) => e.preventDefault()}
                            onMouseMove={() => {
                              if (attivo !== indice) setAttivo(indice);
                            }}
                            onClick={() => scegli(risultato)}
                            className="group/opzione flex min-h-12 cursor-pointer flex-col justify-center border-l-4 border-transparent px-inset py-space-2 [overflow-wrap:anywhere] hover:bg-neutral-100 data-active:border-primary data-active:bg-tape data-active:text-primary"
                          >
                            <span className="font-heading font-semibold">
                              {risultato.titolo}
                            </span>
                            <span className="text-sm text-muted-foreground group-data-active/opzione:text-primary">
                              {risultato.dettaglio}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          <p
            aria-hidden
            data-slot="palette-tasti"
            className="hidden shrink-0 flex-wrap items-center gap-x-space-4 gap-y-space-1 border-t border-border px-inset py-space-2 text-sm text-muted-foreground pointer-fine:flex"
          >
            <span className="inline-flex items-center gap-space-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> per scegliere
            </span>
            <span className="inline-flex items-center gap-space-1">
              <Kbd>Invio</Kbd> per aprire
            </span>
            <span className="inline-flex items-center gap-space-1">
              <Kbd>Esc</Kbd> per chiudere
            </span>
          </p>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
