"use client";

import { useCallback, type MouseEvent } from "react";
import { LiveAnnouncer } from "@/components/live/live-announcer";
import { LiveBarConnected } from "@/components/live/live-bar";
import { LiveProvider, useLive } from "@/components/live/live-provider";
import { PhaseBadge, Tape } from "@/components/scoreboard";
import { buttonVariants } from "@/components/ui/button";
import type {
  LiveConnectionOptions,
  LiveStatus,
} from "@/lib/live/client/live-connection";
import type { LiveEvent, LiveSync } from "@/lib/live/types";
import {
  annuncioTabellone,
  eventoDelTabellone,
} from "@/lib/tabellone/annuncio";
import { LIVELLO_DELLA_FASE, LIVELLO_LABEL } from "@/lib/tabellone/fasi";
import {
  gironiPerLivello,
  miaPosizione,
  titoloBoard,
  type MeTabellone,
  type MiaPosizione,
} from "@/lib/tabellone/posizione";
import type { BoardTabellone, StageBoard } from "@/lib/tabellone/types";
import { gironeAncora, tabelloneSnapshotUrl } from "@/lib/tappe/paths";
import { FasiTabellone } from "./fasi-tabellone";
import { GironeTabelloneCard } from "./girone-tabellone";

export type TabelloneLiveProps = {
  tappaId: string;
  initial: LiveSync;
  /** Registration id of the player; null for a spectator. */
  me: MeTabellone;
  /** `false` renders the snapshot only (stories). */
  connect?: boolean;
  initialStatus?: LiveStatus;
  /** Overrides the transport (tests). */
  connection?: Partial<LiveConnectionOptions>;
  /** Overrides `prefers-reduced-motion` (stories, tests). */
  reducedMotion?: boolean;
};

/**
 * w-tabellone (BLVS-48): the phases of a stage's boards, the player's
 * place and every group with its qualifying line, updated live. One polite
 * announcer says one short sentence per update; focus never moves.
 */
export function TabelloneLive({
  tappaId,
  initial,
  me,
  connect = true,
  initialStatus,
  connection,
  reducedMotion,
}: TabelloneLiveProps) {
  const accept = useCallback(
    (event: LiveEvent) => eventoDelTabellone(event, tappaId),
    [tappaId],
  );
  const format = useCallback(
    (event: LiveEvent) => annuncioTabellone(event, me),
    [me],
  );
  return (
    <LiveProvider
      initial={initial}
      connect={connect}
      initialStatus={initialStatus}
      accept={accept}
      connection={{ snapshotUrl: tabelloneSnapshotUrl(tappaId), ...connection }}
    >
      <div className="flex flex-col gap-stack-lg" data-testid="tabellone">
        <LiveBarConnected />
        <LiveAnnouncer
          types={["stage-board"]}
          filter={accept}
          format={format}
        />
        <TabelloneBody
          tappaId={tappaId}
          me={me}
          reducedMotion={reducedMotion}
        />
      </div>
    </LiveProvider>
  );
}

function TabelloneBody({
  tappaId,
  me,
  reducedMotion,
}: {
  tappaId: string;
  me: MeTabellone;
  reducedMotion?: boolean;
}) {
  const { snapshot } = useLive();
  const stage = snapshot.stageBoards?.find((s) => s.stageId === tappaId);
  if (!stage) {
    return (
      <p className="border border-border p-inset">
        I gironi di questa tappa non sono disponibili adesso. Riprova tra poco.
      </p>
    );
  }
  if (stage.statoTappa === "annullata") {
    return (
      <p
        className="border-2 border-primary p-inset font-semibold"
        data-testid="tappa-annullata"
      >
        La tappa è stata annullata: non ci sono gironi né fasi da seguire.
      </p>
    );
  }
  return (
    <TabelloneGiocatore stage={stage} me={me} reducedMotion={reducedMotion} />
  );
}

/** The screen itself, from one stage's boards (also used by stories). */
export function TabelloneGiocatore({
  stage,
  me,
  reducedMotion,
}: {
  stage: StageBoard;
  me: MeTabellone;
  reducedMotion?: boolean;
}) {
  const mia = miaPosizione(stage, me);
  // The player's own board first.
  const boards =
    mia?.stato === "in_girone"
      ? [...stage.boards].sort(
          (a, b) =>
            Number(b.categoria === mia.categoria) -
            Number(a.categoria === mia.categoria),
        )
      : stage.boards;
  return (
    <>
      <LaTuaPosizione mia={mia} />
      {boards.map((board) => (
        <BoardSection
          key={board.categoria}
          board={board}
          me={me}
          reducedMotion={reducedMotion}
        />
      ))}
    </>
  );
}

/** Opens the group (and its collapsed level, if any) and moves focus. */
function apriGirone(event: MouseEvent<HTMLAnchorElement>, gironeId: string) {
  const target = document.getElementById(gironeAncora(gironeId));
  if (!target) return;
  event.preventDefault();
  const details = target.closest("details");
  if (details && !details.open) details.open = true;
  history.replaceState(null, "", `#${gironeAncora(gironeId)}`);
  target.scrollIntoView({ block: "start" });
  target.focus({ preventScroll: true });
}

/** «La tua posizione» (R-07): the first thing on the page. */
function LaTuaPosizione({ mia }: { mia: MiaPosizione | null }) {
  return (
    <section
      aria-labelledby="tabellone-mia-titolo"
      data-testid="la-tua-posizione"
      className="flex flex-col border-2 border-primary bg-background"
    >
      <Tape size={8} />
      <div className="flex flex-col items-start gap-space-3 p-inset md:p-inset-lg">
        <h2
          id="tabellone-mia-titolo"
          className="font-heading text-xl font-semibold"
        >
          La tua posizione
        </h2>
        {mia === null ? (
          <p>
            Non risulti iscritto a questa tappa: qui vedi i gironi e le fasi.
          </p>
        ) : mia.stato === "senza_girone" ? (
          <p>
            Non sei ancora in un girone: lo vedi qui appena i gironi vengono
            composti.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-space-4 gap-y-space-2">
              <p className="font-mono text-4xl font-semibold tabular-nums">
                {mia.posizione}
              </p>
              <p className="font-heading text-lg font-semibold break-words">
                {mia.girone.nome}
              </p>
              {mia.girone.colore ? (
                <PhaseBadge phase={mia.girone.colore} />
              ) : null}
            </div>
            {mia.riga.position === null ? (
              <p>Il girone non ha ancora risultati.</p>
            ) : null}
            {mia.taglio ? (
              <p className="font-semibold" data-testid="mia-posizione-taglio">
                {mia.taglio}.
              </p>
            ) : null}
            <a
              href={`#${gironeAncora(mia.girone.id)}`}
              onClick={(event) => apriGirone(event, mia.girone.id)}
              className={buttonVariants({
                variant: "primary",
                className: "max-w-full",
              })}
            >
              Apri il tuo girone
            </a>
          </>
        )}
      </div>
    </section>
  );
}

function BoardSection({
  board,
  me,
  reducedMotion,
}: {
  board: BoardTabellone;
  me: MeTabellone;
  reducedMotion?: boolean;
}) {
  const titolo = titoloBoard(board.categoria);
  const titoloId = `tabellone-${board.categoria}-titolo`;
  const { correnti, precedenti } = gironiPerLivello(board);
  const livello = LIVELLO_DELLA_FASE[board.fase];
  const livelliPrecedenti = [...new Set(precedenti.map((g) => g.livello))];
  return (
    <section
      aria-labelledby={titoloId}
      data-testid={`board-${board.categoria}`}
      className="flex flex-col gap-stack"
    >
      <h2 id={titoloId} className="font-heading text-2xl font-semibold">
        {titolo}
      </h2>
      <FasiTabellone
        corrente={board.fase}
        label={`Fasi del ${titolo.toLowerCase()}`}
        reducedMotion={reducedMotion}
      />
      <h3 className="font-heading text-xl font-semibold">
        {LIVELLO_LABEL[livello]}
      </h3>
      {correnti.length > 0 ? (
        <div className="grid gap-stack xl:grid-cols-2">
          {correnti.map((girone) => (
            <GironeTabelloneCard
              key={girone.id}
              girone={girone}
              me={me}
              reducedMotion={reducedMotion}
            />
          ))}
        </div>
      ) : (
        <p className="border border-border p-inset">
          {board.fase === "iscrizioni"
            ? "I gironi non sono ancora stati composti."
            : "Nessun girone in questa fase."}
        </p>
      )}
      {livelliPrecedenti.map((l) => (
        <details
          key={l}
          className="border-2 border-border [&[open]>summary]:border-b-2 [&[open]>summary]:border-border"
        >
          <summary className="flex min-h-11 cursor-pointer items-center p-inset font-heading font-semibold">
            {LIVELLO_LABEL[l]} · fase giocata
          </summary>
          <div className="grid gap-stack p-inset xl:grid-cols-2">
            {precedenti
              .filter((g) => g.livello === l)
              .map((girone) => (
                <GironeTabelloneCard
                  key={girone.id}
                  girone={girone}
                  me={me}
                  reducedMotion={reducedMotion}
                />
              ))}
          </div>
        </details>
      ))}
    </section>
  );
}
