// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLiveBus } from "./bus";
import {
  createBroadcastRelay,
  createSupabaseRelay,
  RELAY_EVENT,
  signRelayMessage,
  verifyRelayMessage,
  type BroadcastChannel,
  type RelayMessage,
} from "./relay";
import type { LiveMatch, LiveSnapshot } from "./types";

vi.mock("server-only", () => ({}));

const KEY = "sb_secret_test";
const empty: LiveSnapshot = {
  seq: 0,
  updatedAt: "2026-06-14T08:00:00.000Z",
  matches: [],
  groups: [],
  overall: [],
  pendingScores: [],
};
const match: LiveMatch = {
  id: "m1",
  court: "Campo 1",
  groupId: "a",
  groupLabel: "Girone A",
  home: "A",
  away: "B",
  sets: [[21, 18]],
};

/** An in-memory Realtime topic: like Supabase, no echo to the sender. */
function createHub() {
  const members: ((payload: unknown) => void)[] = [];
  return {
    channel(): BroadcastChannel & { inject(payload: unknown): void } {
      let receive: (payload: unknown) => void = () => {};
      const self = {
        on(
          _t: "broadcast",
          f: { event: string },
          cb: (m: { payload: unknown }) => void,
        ) {
          expect(f.event).toBe(RELAY_EVENT);
          receive = (payload) => cb({ payload });
          members.push((payload) => receive(payload));
          return self;
        },
        subscribe() {
          return self;
        },
        async send(m: { payload: unknown }) {
          for (const member of members) {
            if (member !== members[index]) member(m.payload);
          }
          return "ok";
        },
        inject(payload: unknown) {
          receive(payload);
        },
      };
      const index = members.length;
      return self;
    },
  };
}

const message: RelayMessage = {
  payload: { type: "score", match },
  seq: 1_781_424_000_000,
  savedAt: "2026-06-14T08:30:00.000Z",
  origin: "istanza-a",
};

describe("firma dei messaggi del relay", () => {
  it("accetta un messaggio firmato con la chiave del server", () => {
    expect(verifyRelayMessage(signRelayMessage(message, KEY), KEY)).toEqual(
      message,
    );
  });

  it("scarta messaggi senza firma, alterati o firmati con un'altra chiave", () => {
    expect(verifyRelayMessage(message, KEY)).toBeNull();
    expect(
      verifyRelayMessage(signRelayMessage(message, "altra"), KEY),
    ).toBeNull();
    const signed = signRelayMessage(message, KEY);
    expect(
      verifyRelayMessage(
        {
          ...signed,
          payload: { type: "score", match: { ...match, home: "X" } },
        },
        KEY,
      ),
    ).toBeNull();
    expect(verifyRelayMessage({ ...signed, firma: "zz" }, KEY)).toBeNull();
    expect(verifyRelayMessage(null, KEY)).toBeNull();
    expect(
      verifyRelayMessage(
        signRelayMessage(
          { ...message, payload: { type: "boh" } as never },
          KEY,
        ),
        KEY,
      ),
    ).toBeNull();
  });
});

describe("bus con relay tra istanze", () => {
  it("un salvataggio su un'istanza raggiunge gli iscritti dell'altra", () => {
    const hub = createHub();
    const a = createLiveBus(
      empty,
      200,
      createBroadcastRelay(hub.channel(), KEY, "a"),
    );
    const b = createLiveBus(
      empty,
      200,
      createBroadcastRelay(hub.channel(), KEY, "b"),
    );
    const ricevuti = vi.fn();
    b.subscribe(ricevuti);
    const inA = vi.fn();
    a.subscribe(inA);

    const saved = new Date("2026-06-14T08:30:00.000Z");
    const event = a.publish({ type: "score", match }, saved);

    return vi.waitFor(() => {
      expect(ricevuti).toHaveBeenCalledTimes(1);
      // The publisher applies its own event once: no echo.
      expect(inA).toHaveBeenCalledTimes(1);
      expect(b.snapshot().matches).toEqual([match]);
      // Same seq on both instances: comparable across them.
      expect(b.snapshot().seq).toBe(event.seq);
      expect(event.seq).toBe(saved.getTime());
      expect(ricevuti.mock.calls[0][0].savedAt).toBe(saved.toISOString());
    });
  });

  it("il seq non torna mai indietro, anche con orologi diversi", () => {
    const hub = createHub();
    const a = createLiveBus(
      empty,
      200,
      createBroadcastRelay(hub.channel(), KEY, "a"),
    );
    const b = createLiveBus(
      empty,
      200,
      createBroadcastRelay(hub.channel(), KEY, "b"),
    );
    const first = b.publish({ type: "score", match }, new Date(2_000));
    a.publish({ type: "score", match }, new Date(1_000));
    return vi.waitFor(() => {
      expect(b.snapshot().seq).toBe(first.seq + 1);
    });
  });

  it("ignora un evento falsificato da chi conosce solo la chiave pubblica", () => {
    const hub = createHub();
    const channel = hub.channel();
    const bus = createLiveBus(
      empty,
      200,
      createBroadcastRelay(channel, KEY, "a"),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    channel.inject({ ...message, origin: "intruso", firma: "00" });
    expect(bus.snapshot().matches).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("senza relay il seq resta un contatore", () => {
    const bus = createLiveBus(empty);
    expect(bus.publish({ type: "score", match }, new Date(5_000)).seq).toBe(1);
  });
});

describe("createSupabaseRelay", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("è spento senza chiave segreta, senza client o con LIVE_RELAY=off", () => {
    const client = { channel: vi.fn() } as never;
    expect(createSupabaseRelay(null, KEY)).toBeNull();
    expect(createSupabaseRelay(client, null)).toBeNull();
    vi.stubEnv("LIVE_RELAY", "off");
    expect(createSupabaseRelay(client, KEY)).toBeNull();
  });

  it("apre il canale broadcast senza eco al mittente", () => {
    const hub = createHub();
    const channel = vi.fn(() => hub.channel());
    expect(createSupabaseRelay({ channel } as never, KEY)).not.toBeNull();
    expect(channel).toHaveBeenCalledWith("blvs-live", {
      config: { broadcast: { self: false, ack: false } },
    });
  });
});
