"use client";

import { AlertCircleIcon, ArrowLeftIcon, WifiOffIcon } from "lucide-react";
import Link from "next/link";
import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLive } from "@/components/live";
import { Tape } from "@/components/scoreboard";
import { buttonVariants } from "@/components/ui/button";
import { useOnline } from "@/hooks/use-online";
import { CATEGORIE } from "@/lib/db/types";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";
import {
  avvioFasePath,
  CATEGORIA_NOME,
  CATEGORIA_SEGMENTO,
} from "@/lib/tappe/avvio/paths";
import { gestioneTappaPath } from "@/lib/tappe/gestione-state";
import {
  avanzamentoFase,
  faseCorrente,
  FASE_GIOCO_LABEL,
  FASE_PARTITA_LABEL,
  isDaInserire,
  partiteInCorso,
  raggruppaPartite,
} from "@/lib/tappe/live-admin/format";
import { adminLivePath } from "@/lib/tappe/live-admin/paths";
import {
  initialAzionePartitaState,
  LIVE_ADMIN_MESSAGES,
  type AzionePartitaAction,
  type AzionePartitaState,
  type OperazionePartita,
} from "@/lib/tappe/live-admin/state";
import {
  chiaveTabellone,
  type PartitaLive,
  type TabelloneLive,
} from "@/lib/tappe/live-admin/types";
import { AvanzamentoFase } from "./avanzamento-fase";
import { PartitaVoce, type AzioniVoce } from "./partita-voce";
import { PunteggioDialog } from "./punteggio-dialog";

type AdminLiveProps = {
  view: TabelloneLive;
  /** `aggiornaPartita` («Inizia», «Concludi»); a fake in Storybook. */
  azione: AzionePartitaAction;
  /** `salvaPunteggio`; a fake in Storybook. */
  punteggio: AzionePartitaAction;
  /** Storybook/axe: force offline, starting outcome. */
  offline?: boolean;
  initialState?: AzionePartitaState;
  /**
   * Extra content per group id, under the group's name (BLVS-38: the
   * «Parità da risolvere» signal and its dialog).
   */
  extraGironi?: Readonly<Record<string, ReactNode>>;
};

const OFFLINE_ID = "admin-live-offline";

function focusOn(el: HTMLElement | null) {
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView?.({ block: "nearest" });
}

/**
 * The board's matches: the server's, or those of a newer live event from
 * another admin's change (`board-matches`).
 */
function usePartiteCorrenti(view: TabelloneLive): {
  partite: readonly PartitaLive[];
  adesso: Date;
} {
  const { snapshot } = useLive();
  const chiave = chiaveTabellone(view.tappa.id, view.categoria);
  const board = snapshot.boards?.find((b) => b.id === chiave);
  if (board && board.updatedAt > view.lettoIl) {
    return { partite: board.matches, adesso: new Date(board.updatedAt) };
  }
  return { partite: view.partite, adesso: new Date(view.lettoIl) };
}

/** M/F switch: one board at a time. */
function SceltaTabellone({ view }: { view: TabelloneLive }) {
  return (
    <nav aria-label="Tabellone" className="flex flex-wrap gap-space-2">
      {CATEGORIE.map((c) => {
        const attuale = c === view.categoria;
        return (
          <Link
            key={c}
            href={adminLivePath(view.tappa.id, c)}
            aria-current={attuale ? "page" : undefined}
            className={buttonVariants({
              variant: attuale ? "primary" : "secondary",
              size: "campo",
              className: "max-w-full",
            })}
          >
            Tabellone {CATEGORIA_NOME[c]}
          </Link>
        );
      })}
    </nav>
  );
}

/** Phase not started: nothing to follow yet (state: empty). */
export function AdminLiveVuota({ view }: { view: TabelloneLive }) {
  return (
    <div
      className="flex flex-col items-start gap-space-3 border-2 border-neutral-200 p-inset"
      data-testid="admin-live-vuota"
    >
      <p className="font-heading text-lg font-semibold">
        Nessuna partita da seguire: la fase di questo tabellone non è ancora
        avviata.
      </p>
      <Link
        href={avvioFasePath(view.tappa.id, view.categoria)}
        className={buttonVariants({
          variant: "primary",
          size: "campo",
          className: "max-w-full",
        })}
      >
        Vai all&apos;avvio della fase
      </Link>
    </div>
  );
}

/**
 * w-admin-live: for one board of a stage, the matches in progress as
 * cards, every match by phase and group, and the phase's progress. «Inizia»,
 * «Concludi» and the score dialog save at once; every other admin's screen
 * follows over the live channel.
 */
export function AdminLive({
  view,
  azione,
  punteggio,
  offline: forceOffline,
  initialState = initialAzionePartitaState,
  extraGironi,
}: AdminLiveProps) {
  const online = useOnline(
    forceOffline === undefined ? undefined : !forceOffline,
  );
  const { partite, adesso } = usePartiteCorrenti(view);
  const esitoRef = useRef<HTMLParagraphElement>(null);

  const safeAction = useCallback<AzionePartitaAction>(
    async (prev, formData) => {
      try {
        return await azione(prev, formData);
      } catch (error) {
        console.error("[admin-live] richiesta non riuscita", error);
        return {
          status: "error",
          reason: "network",
          message: LIVE_ADMIN_MESSAGES.network,
          at: prev.status === "idle" ? 1 : prev.at + 1,
        };
      }
    },
    [azione],
  );
  const [state, formAction, pending] = useActionState(safeAction, initialState);
  const [inAttesa, setInAttesa] = useState<AzioniVoce["inAttesa"]>(null);
  // The last outcome of any action, the score dialog's included.
  const [esito, setEsito] = useState<AzionePartitaState>(initialState);

  const [visto, setVisto] = useState(state);
  if (state !== visto) {
    setVisto(state);
    setEsito(state);
  }

  // A started or concluded match leaves the button that was pressed: the
  // outcome message takes the focus, so it never falls to <body>.
  useEffect(() => {
    if (esito.status === "success") focusOn(esitoRef.current);
  }, [esito]);

  const onEsitoDialog = useCallback((s: AzionePartitaState) => setEsito(s), []);

  const onOperazione = useCallback(
    (formData: FormData) => {
      setInAttesa({
        partitaId: String(formData.get("partitaId")),
        operazione: String(formData.get("operazione")) as OperazionePartita,
      });
      startTransition(() => formAction(formData));
    },
    [formAction],
  );

  if (view.faseGioco === null && view.partite.length === 0) {
    return (
      <div className="flex flex-col gap-stack-lg" data-testid="admin-live">
        <Intestazione view={view} />
        <AdminLiveVuota view={view} />
      </div>
    );
  }

  const fase = faseCorrente(partite);
  const avanzamento = avanzamentoFase(partite, fase, adesso);
  const inCorso = partiteInCorso(partite);
  const fasi = raggruppaPartite(partite);
  const disabled = !online;

  const voce = (partita: PartitaLive) => {
    const campi = (
      <>
        <input type="hidden" name="tappaId" value={view.tappa.id} />
        <input
          type="hidden"
          name="categoria"
          value={CATEGORIA_SEGMENTO[view.categoria]}
        />
        <input type="hidden" name="partitaId" value={partita.id} />
      </>
    );
    return (
      <PartitaVoce
        partita={partita}
        daInserire={isDaInserire(partita, adesso)}
        azioni={{
          campi,
          onOperazione,
          inAttesa: pending ? inAttesa : null,
          disabled,
          describedBy: disabled ? OFFLINE_ID : undefined,
          punteggio: (
            <PunteggioDialog
              partita={partita}
              tappaId={view.tappa.id}
              categoria={view.categoria}
              action={punteggio}
              disabled={disabled}
              describedBy={disabled ? OFFLINE_ID : undefined}
              onEsito={onEsitoDialog}
            />
          ),
        }}
      />
    );
  };

  const errore = esito.status === "error" ? esito : null;

  return (
    <div className="flex flex-col gap-stack-lg" data-testid="admin-live">
      <Intestazione view={view} />

      {disabled ? (
        <p
          id={OFFLINE_ID}
          className="flex items-start gap-space-2 border-2 border-warning-fg bg-warning-bg p-inset font-semibold text-warning-fg"
        >
          <WifiOffIcon aria-hidden className="mt-1 size-4 shrink-0" />
          {LIVE_ADMIN_MESSAGES.offline}
        </p>
      ) : null}

      <AvanzamentoFase
        avanzamento={avanzamento}
        faseLabel={
          fase === "gironi" && view.faseGioco
            ? FASE_GIOCO_LABEL[view.faseGioco]
            : fase
              ? FASE_PARTITA_LABEL[fase]
              : "—"
        }
      />

      <div className="flex flex-col gap-space-2">
        <div role="alert" data-testid="admin-live-errore">
          {errore ? (
            <div className="flex flex-col items-start gap-space-2 border-2 border-error-fg bg-error-bg p-inset text-error-fg">
              <p className="flex items-start gap-space-2 font-semibold">
                <AlertCircleIcon aria-hidden className="mt-1 size-4 shrink-0" />
                {errore.message}
              </p>
              {errore.reason === "sessionExpired" ? (
                <Link
                  href={sessionExpiredHref(
                    adminLivePath(view.tappa.id, view.categoria),
                  )}
                  className={buttonVariants({
                    variant: "primary",
                    size: "campo",
                  })}
                >
                  Accedi di nuovo
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
        <p
          ref={esitoRef}
          tabIndex={-1}
          data-testid="admin-live-esito"
          className="self-start font-semibold focus-ring empty:hidden"
        >
          {esito.status === "success" ? esito.message : ""}
        </p>
      </div>

      <section
        aria-labelledby="in-corso-titolo"
        className="flex flex-col gap-stack-sm"
        data-testid="partite-in-corso"
      >
        <h2 id="in-corso-titolo" className="font-heading text-xl font-semibold">
          In corso
        </h2>
        {inCorso.length === 0 ? (
          <p>Nessuna partita in corso in questo momento.</p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] gap-stack">
            {inCorso.map((p) => (
              <li key={p.id}>{voce(p)}</li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="tutte-titolo"
        className="flex flex-col gap-stack"
        data-testid="tutte-le-partite"
      >
        <h2 id="tutte-titolo" className="font-heading text-xl font-semibold">
          Tutte le partite
        </h2>
        {fasi.map((f) => (
          <section
            key={f.fase}
            aria-labelledby={`fase-${f.fase}`}
            className="flex flex-col gap-stack-sm"
          >
            <h3
              id={`fase-${f.fase}`}
              className="font-heading text-lg font-semibold"
            >
              Fase: {f.label}
            </h3>
            {f.gironi.map((g) => {
              const titoloId = `girone-live-${g.id ?? f.fase}`;
              return (
                <section
                  key={g.id ?? f.fase}
                  aria-labelledby={g.nome ? titoloId : undefined}
                  aria-label={g.nome ? undefined : f.label}
                  className="flex flex-col gap-space-3"
                >
                  {g.nome ? (
                    <div className="flex flex-col gap-space-1">
                      <h4 id={titoloId} className="font-heading font-semibold">
                        {g.nome}
                      </h4>
                      <Tape size={4} className="max-w-16" />
                    </div>
                  ) : null}
                  {g.id ? extraGironi?.[g.id] : null}
                  <ol className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] gap-stack">
                    {g.partite.map((p) => (
                      <li key={p.id}>{voce(p)}</li>
                    ))}
                  </ol>
                </section>
              );
            })}
          </section>
        ))}
      </section>

      <Link
        href={gestioneTappaPath(view.tappa.id)}
        className="inline-flex min-h-12 items-center gap-space-2 self-start font-heading font-semibold underline decoration-2 underline-offset-4 focus-ring"
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        Torna alla tappa
      </Link>
    </div>
  );
}

function Intestazione({ view }: { view: TabelloneLive }) {
  return (
    <section
      aria-labelledby="live-tappa"
      className="flex flex-col gap-stack-sm"
    >
      <div className="flex flex-col gap-space-1">
        <h2
          id="live-tappa"
          className="font-heading text-2xl font-semibold text-balance [overflow-wrap:anywhere]"
        >
          {view.tappa.nome}
        </h2>
        <p className="font-heading font-semibold">
          Tabellone {CATEGORIA_NOME[view.categoria]}
        </p>
      </div>
      <SceltaTabellone view={view} />
    </section>
  );
}
