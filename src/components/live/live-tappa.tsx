"use client";

import { AlertCircleIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef } from "react";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/responsive-table/responsive-table";
import { PhaseBadge, Tape } from "@/components/scoreboard";
import { buttonVariants } from "@/components/ui/button";
import type {
  LiveConnectionOptions,
  LiveStatus,
} from "@/lib/live/client/live-connection";
import {
  annuncioPartita,
  eventoDellaTappa,
  mioLato,
  vistaLive,
  type FasiTabelloni,
  type LiveMe,
} from "@/lib/live/tappa";
import type {
  GroupStandingRow,
  GroupStandings,
  LiveEvent,
  LiveMatch,
  LivePlayer,
  LiveSync,
} from "@/lib/live/types";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";
import { liveTappaHref, liveTappaSnapshotUrl } from "@/lib/tappe/paths";
import { cn } from "@/lib/utils";
import { LiveAnnouncer } from "./live-announcer";
import { LiveBarConnected } from "./live-bar";
import { LiveProvider, useLive } from "./live-provider";
import { liveRowAttributes, useLiveRowMotion } from "./use-live-row-motion";

export type LiveTappaProps = {
  tappaId: string;
  initial: LiveSync;
  /** Registration id of the player; null for a spectator. */
  me: LiveMe;
  fasi: FasiTabelloni;
  /** `false` renders the snapshot only (stories). */
  connect?: boolean;
  initialStatus?: LiveStatus;
  /** Overrides the transport (tests). */
  connection?: Partial<LiveConnectionOptions>;
};

/**
 * w-live (BLVS-36): the live screen of one stage for a player. Their own
 * matches and group first, then what is on court now. One polite
 * announcer speaks the changes; rows never are live regions and focus
 * never moves.
 */
export function LiveTappa({
  tappaId,
  initial,
  me,
  fasi,
  connect = true,
  initialStatus,
  connection,
}: LiveTappaProps) {
  const accept = useCallback(
    (event: LiveEvent) => eventoDellaTappa(event, tappaId),
    [tappaId],
  );
  const format = useCallback(
    (event: LiveEvent) => annuncioPartita(event, me),
    [me],
  );
  return (
    <LiveProvider
      initial={initial}
      connect={connect}
      initialStatus={initialStatus}
      accept={accept}
      connection={{ snapshotUrl: liveTappaSnapshotUrl(tappaId), ...connection }}
    >
      <div className="flex flex-col gap-stack-lg" data-testid="live-tappa">
        <LiveBarConnected />
        <LiveAnnouncer
          types={["score", "group-standings", "phase-started"]}
          filter={accept}
          format={format}
        />
        <LiveTappaBody me={me} fasi={fasi} />
      </div>
    </LiveProvider>
  );
}

function LiveTappaBody({ me, fasi }: { me: LiveMe; fasi: FasiTabelloni }) {
  const { snapshot } = useLive();
  const vista = vistaLive(snapshot, me);
  const vuota = snapshot.matches.length === 0;

  return (
    <>
      {me ? (
        <section
          aria-labelledby="live-mie-titolo"
          className="flex flex-col gap-stack"
        >
          <h2
            id="live-mie-titolo"
            className="font-heading text-xl font-semibold"
          >
            Le tue partite
          </h2>
          {vista.mie.length > 0 ? (
            <MatchList
              matches={vista.mie}
              me={me}
              fasi={fasi}
              mine
              testId="live-mie-partite"
            />
          ) : (
            <p className="border border-border p-inset">
              Non hai ancora partite in questa tappa.
            </p>
          )}
        </section>
      ) : (
        <p className="border border-border p-inset">
          Non risulti iscritto a questa tappa: qui vedi le partite in campo.
        </p>
      )}

      {vista.mioGirone ? (
        <MioGirone
          group={vista.mioGirone}
          me={me}
          fase={vista.mioGirone.category && fasi[vista.mioGirone.category]}
        />
      ) : null}

      <section
        aria-labelledby="live-in-campo-titolo"
        className="flex flex-col gap-stack"
      >
        <h2
          id="live-in-campo-titolo"
          className="font-heading text-xl font-semibold"
        >
          In campo adesso
        </h2>
        {vista.inCampo.length > 0 ? (
          <MatchList
            matches={vista.inCampo}
            me={me}
            fasi={fasi}
            testId="live-in-campo"
          />
        ) : (
          <p className="border border-border p-inset">
            {vuota
              ? "Le partite della tappa non sono ancora iniziate."
              : "Nessuna partita in campo adesso."}
          </p>
        )}
      </section>
    </>
  );
}

function MatchList({
  matches,
  me,
  fasi,
  mine = false,
  testId,
}: {
  matches: readonly LiveMatch[];
  me: LiveMe;
  fasi: FasiTabelloni;
  mine?: boolean;
  testId: string;
}) {
  const ref = useRef<HTMLUListElement>(null);
  useLiveRowMotion(ref);
  return (
    <ul
      ref={ref}
      data-testid={testId}
      className="grid gap-stack md:grid-cols-2"
    >
      {matches.map((match) => (
        <MatchCard
          key={match.id}
          match={match}
          me={me}
          fase={match.category && fasi[match.category]}
          mine={mine}
        />
      ))}
    </ul>
  );
}

const STATO: Record<NonNullable<LiveMatch["state"]>, string> = {
  programmata: "Da giocare",
  in_corso: "Live",
  conclusa: "Finita",
  annullata: "Annullata",
};

function setsLabel(match: LiveMatch) {
  if (match.sets.length === 0) return "nessun punto ancora";
  return match.sets
    .map(([home, away], i) => `set ${i + 1} ${home} a ${away}`)
    .join(", ");
}

function Team({
  players,
  fallback,
  me,
}: {
  players: readonly LivePlayer[] | undefined;
  fallback: string;
  me: LiveMe;
}) {
  if (!players || players.length === 0) return <>{fallback}</>;
  return (
    <>
      {players.map((p, i) => (
        <span key={p.id}>
          {i > 0 ? <span className="font-normal"> e </span> : null}
          {p.name}
          {p.id === me ? <span className="font-normal"> (tu)</span> : null}
        </span>
      ))}
    </>
  );
}

function MatchCard({
  match,
  me,
  fase,
  mine,
}: {
  match: LiveMatch;
  me: LiveMe;
  fase: FasiTabelloni[keyof FasiTabelloni];
  mine: boolean;
}) {
  const state = match.state ?? "in_corso";
  const lato = mioLato(match, me);
  return (
    <li
      {...liveRowAttributes(match.id, match)}
      data-mia={lato ? "true" : undefined}
      data-live-highlight={mine ? "outline" : undefined}
      className={cn(
        "flex min-w-0 flex-col border-2",
        mine
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground",
      )}
    >
      {mine ? <Tape size={8} /> : null}
      <div className="flex flex-col gap-space-3 p-inset-lg">
        <div className="flex flex-wrap items-center gap-space-3">
          {state === "in_corso" ? (
            <p className="bg-live-bg px-space-2 py-space-1 text-xs font-semibold tracking-wide text-live-fg uppercase">
              Live
            </p>
          ) : (
            <p className="border border-current px-space-2 py-space-1 text-xs font-semibold tracking-wide uppercase">
              {STATO[state]}
            </p>
          )}
          <p className="text-sm [overflow-wrap:anywhere]">
            {match.court} · {match.groupLabel}
          </p>
          {fase ? <PhaseBadge phase={fase} /> : null}
        </div>
        <h3 className="font-heading text-lg font-semibold break-words">
          <Team players={match.players?.home} fallback={match.home} me={me} />{" "}
          <span className="font-normal">contro</span>{" "}
          <Team players={match.players?.away} fallback={match.away} me={me} />
        </h3>
        <p
          className="flex flex-wrap gap-x-space-4 font-mono text-2xl font-semibold tabular-nums"
          data-slot="live-punteggio"
        >
          <span className="sr-only">{setsLabel(match)}</span>
          {match.sets.length > 0 ? (
            match.sets.map(([h, a], i) => (
              <span key={i} aria-hidden="true" className="whitespace-nowrap">
                {i > 0 ? "· " : null}
                {h}–{a}
              </span>
            ))
          ) : (
            <span aria-hidden="true" className="whitespace-nowrap">
              –
            </span>
          )}
        </p>
      </div>
    </li>
  );
}

function MioGirone({
  group,
  me,
  fase,
}: {
  group: GroupStandings;
  me: LiveMe;
  fase: FasiTabelloni[keyof FasiTabelloni];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLiveRowMotion(ref);
  const columns: ResponsiveTableColumn<GroupStandingRow>[] = [
    {
      key: "position",
      header: "Posizione",
      numeric: true,
      align: "start",
      width: "16%",
    },
    {
      key: "pair",
      header: "Giocatore",
      rowHeader: true,
      render: (row) => (
        <span className="inline-flex flex-wrap items-center gap-space-2 [overflow-wrap:anywhere]">
          {row.pair}
          {row.playerId === me ? (
            <span className="bg-primary px-space-2 font-heading text-xs font-semibold tracking-wider text-primary-foreground uppercase">
              Tu
            </span>
          ) : null}
        </span>
      ),
    },
    { key: "played", header: "Giocate", numeric: true, width: "14%" },
    { key: "won", header: "Vinte", numeric: true, width: "14%" },
    { key: "points", header: "Punti", numeric: true, width: "14%" },
  ];
  return (
    <section
      aria-labelledby="live-girone-titolo"
      className="flex flex-col gap-stack"
    >
      <div className="flex flex-wrap items-center gap-space-3">
        <h2
          id="live-girone-titolo"
          className="font-heading text-xl font-semibold"
        >
          Il tuo girone · {group.label}
        </h2>
        {fase ? <PhaseBadge phase={fase} /> : null}
      </div>
      <div
        ref={ref}
        data-testid="live-mio-girone"
        className="[&_[data-mia=true]]:bg-tape-soft [&_dt]:text-foreground"
      >
        <ResponsiveTable
          caption={`Classifica ${group.label}`}
          captionHidden
          columns={columns}
          rows={group.rows}
          getRowKey={(row) => row.playerId ?? row.pair}
          rowAttributes={(row) => ({
            ...liveRowAttributes(row.playerId ?? row.pair, row),
            ...(row.playerId === me ? { "data-mia": "true" } : {}),
          })}
          cardBadgeKey="position"
          emptyMessage="Nessun giocatore nel girone."
        />
      </div>
    </section>
  );
}

/** Shown in place of the live data when the session has expired. */
export function LiveTappaSessioneScaduta({ tappaId }: { tappaId: string }) {
  return (
    <section
      aria-labelledby="live-sessione-titolo"
      className="flex max-w-2xl flex-col items-start gap-space-3 border-2 border-error-fg bg-error-bg p-inset text-error-fg md:p-inset-lg"
    >
      <h2
        id="live-sessione-titolo"
        className="flex items-start gap-space-2 font-heading text-xl font-semibold"
      >
        <AlertCircleIcon aria-hidden className="mt-1 size-5 shrink-0" />
        Sessione scaduta
      </h2>
      <p>Accedi di nuovo per vedere la tua partita e il tuo girone.</p>
      <Link
        href={sessionExpiredHref(liveTappaHref(tappaId))}
        className={buttonVariants({
          variant: "primary",
          className: "max-w-full",
        })}
      >
        Accedi di nuovo
      </Link>
    </section>
  );
}
