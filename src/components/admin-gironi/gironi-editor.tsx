"use client";

import { LockIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/hooks/use-online";
import { annuncioModifica } from "@/lib/gironi/editor/annunci";
import { controllaGironi } from "@/lib/gironi/editor/controlli";
import { applicaOperazione } from "@/lib/gironi/editor/operazioni";
import {
  CATEGORIA_LABEL,
  GIRONI_EDITOR_MESSAGES as M,
  type Destinazione,
  type EditorGironi,
  type ModificaGironiAction,
  type OperazioneGironi,
} from "@/lib/gironi/editor/types";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";
import { ControlliGironi } from "./controlli-gironi";
import { GironeCard, NonAssegnatiCard, type DragHandlers } from "./girone-card";
import { LegendaFasi } from "./legenda-fasi";
import { SpostaDialog } from "./sposta-dialog";

/** Where focus goes once a change is on screen. */
type Fuoco =
  | { tipo: "giocatore"; iscrizioneId: string }
  | { tipo: "ultimo-girone" }
  | { tipo: "aggiungi" };

type GironiEditorProps = {
  editor: EditorGironi;
  /** Server action, passed in by the page (a fake in Storybook). */
  modifica: ModificaGironiAction;
  /** Storybook: force offline, open «Sposta» for a player. */
  offline?: boolean;
  spostaAperto?: { iscrizioneId: string; verso?: Destinazione };
  /** Storybook: a starting error message. */
  erroreIniziale?: string;
};

function focalizza(el: HTMLElement | null) {
  if (!el) return;
  // Chromium ignores scroll-padding on programmatic focus (BLVS-16).
  el.focus({ preventScroll: true });
  el.scrollIntoView?.({ block: "nearest" });
}

/**
 * w-admin-gironi: the groups of one board, Gold or Silver alike. Players
 * move by drag and drop or, from the keyboard, with «Sposta» and its
 * dialog. Every change is saved at once (optimistic, rolled back if the
 * server refuses it) and announced in words with the checks after it.
 */
export function GironiEditor({
  editor,
  modifica,
  offline,
  spostaAperto,
  erroreIniziale,
}: GironiEditorProps) {
  const { tappa, categoria } = editor;
  const pathname = usePathname();
  const online = useOnline(offline === undefined ? undefined : !offline);
  const [composizione, setComposizione] = useState(editor.composizione);
  const [annuncio, setAnnuncio] = useState("");
  const [errore, setErrore] = useState<string | null>(erroreIniziale ?? null);
  const [pending, startTransition] = useTransition();
  const [trascinato, setTrascinato] = useState<string | null>(null);
  const [sposta, setSposta] = useState<{
    iscrizioneId: string | null;
    open: boolean;
    apertura: number;
  }>({
    iscrizioneId: spostaAperto?.iscrizioneId ?? null,
    open: spostaAperto !== undefined,
    apertura: 0,
  });
  const [fuoco, setFuoco] = useState<Fuoco | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const aggiungiRef = useRef<HTMLButtonElement>(null);
  const inCorso = useRef(false);
  /** Focus to move once «Sposta» has finished closing. */
  const fuocoDopoDialog = useRef<Fuoco | null>(null);

  const esito = controllaGironi(composizione);
  const modificabile = !composizione.bloccata;

  useEffect(() => {
    if (!fuoco) return;
    const root = rootRef.current;
    if (!root) return;
    if (fuoco.tipo === "giocatore") {
      focalizza(
        root.querySelector<HTMLElement>(
          `[data-sposta="${CSS.escape(fuoco.iscrizioneId)}"]`,
        ),
      );
    } else if (fuoco.tipo === "ultimo-girone") {
      const titoli = root.querySelectorAll<HTMLElement>(
        "[data-testid=girone-card] [data-girone-titolo]",
      );
      focalizza(titoli[titoli.length - 1] ?? null);
    } else {
      focalizza(aggiungiRef.current);
    }
  }, [fuoco, composizione]);

  function esegui(operazione: OperazioneGironi, dopo: Fuoco | null) {
    if (!modificabile) return;
    if (inCorso.current) {
      setAnnuncio("Attendi: sto salvando la modifica precedente.");
      return;
    }
    if (!online) {
      setErrore(M.offline);
      return;
    }
    const prima = composizione;
    const locale = applicaOperazione(prima, operazione);
    if (!locale.ok) {
      setErrore(M.notFound);
      return;
    }
    if (locale.composizione === prima) return;
    setErrore(null);
    setComposizione(locale.composizione);
    setFuoco(dopo);
    inCorso.current = true;

    startTransition(async () => {
      try {
        const r = await modifica({
          tappaId: tappa.id,
          categoria,
          versione: prima.versione,
          operazione,
        });
        switch (r.status) {
          case "ok":
            setComposizione(r.composizione);
            setAnnuncio(annuncioModifica(prima, r.composizione, operazione));
            break;
          case "conflict":
          case "bloccata":
            setComposizione(r.composizione);
            setErrore(r.message);
            break;
          case "error":
            setComposizione(r.composizione ?? prima);
            setErrore(r.message);
            break;
          case "sessionExpired":
            setComposizione(prima);
            window.location.assign(sessionExpiredHref(pathname));
            break;
          case "permissionDenied":
            setComposizione(prima);
            setErrore(r.message);
            break;
        }
      } catch (error) {
        console.error("[gironi] modifica non riuscita", error);
        setComposizione(prima);
        setErrore(M.failed);
      } finally {
        inCorso.current = false;
      }
    });
  }

  function spostaTrascinato(op: (id: string) => OperazioneGironi) {
    const id = trascinato;
    setTrascinato(null);
    if (id) esegui(op(id), null);
  }

  const drag: DragHandlers = {
    modificabile,
    trascinato,
    onDragStart: setTrascinato,
    onDragEnd: () => setTrascinato(null),
    onDropSuGiocatore: (b) =>
      spostaTrascinato((a) => ({ tipo: "scambia", a, b })),
    onDropSuLista: (verso) =>
      spostaTrascinato((iscrizioneId) => ({
        tipo: "sposta",
        iscrizioneId,
        verso,
      })),
    onSposta: (iscrizioneId) =>
      setSposta((s) => ({
        iscrizioneId,
        open: true,
        apertura: s.apertura + 1,
      })),
  };

  return (
    <div
      ref={rootRef}
      className="flex flex-col gap-stack-lg"
      data-testid="gironi-editor"
    >
      <div className="flex flex-col gap-stack-sm">
        <p className="[overflow-wrap:anywhere]">
          <span className="font-semibold">{tappa.nome}</span> · tabellone{" "}
          {CATEGORIA_LABEL[categoria]}
        </p>
        <LegendaFasi />
        {modificabile ? (
          <p className="text-sm text-muted-foreground">
            Trascina un giocatore su un girone per spostarlo, o su un altro
            giocatore per scambiarli. Da tastiera usa «Sposta» accanto al nome.
            Ogni modifica si salva subito.
          </p>
        ) : (
          <p
            data-testid="gironi-bloccati"
            className="flex items-start gap-space-2 border-l-4 border-primary bg-neutral-100 p-inset font-semibold"
          >
            <LockIcon aria-hidden className="mt-1 size-4 shrink-0" />
            {M.bloccata}
          </p>
        )}
      </div>

      {/* Always mounted: each change is announced once, in words. */}
      <p
        role="status"
        data-testid="annuncio-gironi"
        className={annuncio ? "border-l-4 border-tape p-space-2" : "sr-only"}
      >
        {annuncio}
      </p>
      {errore ? (
        <p
          role="alert"
          className="flex items-start gap-space-2 border-l-4 border-error-fg bg-error-bg p-inset text-error-fg"
        >
          <TriangleAlertIcon aria-hidden className="mt-1 size-4 shrink-0" />
          <span>
            <span className="sr-only">Errore: </span>
            {errore}
          </span>
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-stack lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <div className="flex flex-col gap-stack">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-stack">
            {composizione.gironi.map((girone) => (
              <GironeCard
                key={girone.id}
                girone={girone}
                drag={drag}
                onElimina={() =>
                  esegui(
                    { tipo: "elimina", gironeId: girone.id },
                    { tipo: "aggiungi" },
                  )
                }
              />
            ))}
          </div>
          {composizione.gironi.length === 0 ? (
            <p className="text-muted-foreground">
              Questo tabellone non ha ancora gironi.
            </p>
          ) : null}
          {modificabile ? (
            <div className="flex flex-wrap items-center gap-space-3">
              {composizione.livello === "gold_silver" ? (
                <>
                  <Button
                    ref={aggiungiRef}
                    className="max-w-full"
                    onClick={() =>
                      esegui(
                        { tipo: "aggiungi", fase: "gold" },
                        { tipo: "ultimo-girone" },
                      )
                    }
                  >
                    <PlusIcon aria-hidden />
                    Aggiungi girone gold
                  </Button>
                  <Button
                    variant="secondary"
                    className="max-w-full"
                    onClick={() =>
                      esegui(
                        { tipo: "aggiungi", fase: "silver" },
                        { tipo: "ultimo-girone" },
                      )
                    }
                  >
                    <PlusIcon aria-hidden />
                    Aggiungi girone silver
                  </Button>
                </>
              ) : (
                <Button
                  ref={aggiungiRef}
                  className="max-w-full"
                  onClick={() =>
                    esegui({ tipo: "aggiungi" }, { tipo: "ultimo-girone" })
                  }
                >
                  <PlusIcon aria-hidden />
                  Aggiungi girone
                </Button>
              )}
              <span className="text-sm text-muted-foreground" aria-hidden>
                {pending ? "Salvataggio…" : null}
              </span>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-stack">
          <ControlliGironi esito={esito} />
          <NonAssegnatiCard giocatori={composizione.nonAssegnati} drag={drag} />
        </div>
      </div>

      <SpostaDialog
        composizione={composizione}
        open={sposta.open}
        iscrizioneId={sposta.iscrizioneId}
        apertura={sposta.apertura}
        destinazioneIniziale={spostaAperto?.verso}
        onOpenChange={(open) => setSposta((s) => ({ ...s, open }))}
        onConferma={(operazione) => {
          const id = sposta.iscrizioneId;
          setSposta((s) => ({ ...s, open: false }));
          fuocoDopoDialog.current = id
            ? { tipo: "giocatore", iscrizioneId: id }
            : null;
          esegui(operazione, null);
        }}
        onChiuso={() => {
          if (fuocoDopoDialog.current) setFuoco(fuocoDopoDialog.current);
          fuocoDopoDialog.current = null;
        }}
      />
    </div>
  );
}
