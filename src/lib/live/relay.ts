import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LIVE_EVENT_TYPES, type LiveEventPayload } from "./types";

/**
 * One event as it travels between server instances: the payload, the
 * publisher's `seq` and save time, and who sent it.
 */
export type RelayMessage = {
  payload: LiveEventPayload;
  seq: number;
  savedAt: string;
  origin: string;
};

/**
 * Fan-out between server instances (BLVS-56). On Vercel the score save and
 * the SSE clients run on different instances, so the in-process bus alone
 * reaches only the clients of the instance that saved.
 */
export type LiveRelay = {
  send(message: Omit<RelayMessage, "origin">): void;
  /** Called for every message published by ANOTHER instance. */
  onReceive(handler: (message: RelayMessage) => void): void;
};

export const RELAY_CHANNEL = "blvs-live";
export const RELAY_EVENT = "evento";

type Signed = RelayMessage & { firma: string };

function sign(message: RelayMessage, key: string): string {
  return createHmac("sha256", key)
    .update(
      JSON.stringify([
        message.origin,
        message.seq,
        message.savedAt,
        message.payload,
      ]),
    )
    .digest("hex");
}

/**
 * The broadcast topic is reachable with the public key too, so every
 * message carries an HMAC made with the server secret: forged events are
 * dropped instead of reaching the players' screens.
 */
export function signRelayMessage(message: RelayMessage, key: string): Signed {
  return { ...message, firma: sign(message, key) };
}

export function verifyRelayMessage(
  raw: unknown,
  key: string,
): RelayMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Partial<Signed>;
  if (
    typeof m.firma !== "string" ||
    typeof m.origin !== "string" ||
    typeof m.savedAt !== "string" ||
    typeof m.seq !== "number" ||
    !Number.isSafeInteger(m.seq) ||
    !m.payload ||
    !LIVE_EVENT_TYPES.includes(m.payload.type)
  ) {
    return null;
  }
  const message: RelayMessage = {
    payload: m.payload,
    seq: m.seq,
    savedAt: m.savedAt,
    origin: m.origin,
  };
  const expected = Buffer.from(sign(message, key), "hex");
  const actual = Buffer.from(m.firma, "hex");
  if (expected.length !== actual.length) return null;
  return timingSafeEqual(expected, actual) ? message : null;
}

/** The subset of a Realtime channel the relay uses (fakeable in tests). */
export type BroadcastChannel = {
  on(
    type: "broadcast",
    filter: { event: string },
    callback: (message: { payload: unknown }) => void,
  ): unknown;
  subscribe(callback?: (status: string, error?: Error) => void): unknown;
  send(message: {
    type: "broadcast";
    event: string;
    payload: unknown;
  }): Promise<unknown>;
};

/**
 * Relay over a Supabase Realtime broadcast channel. Realtime does not echo
 * a message to its sender (`self: false`), and `origin` guards anyway.
 */
export function createBroadcastRelay(
  channel: BroadcastChannel,
  key: string,
  origin: string = randomUUID(),
): LiveRelay {
  const handlers: ((message: RelayMessage) => void)[] = [];
  channel.on("broadcast", { event: RELAY_EVENT }, ({ payload }) => {
    const message = verifyRelayMessage(payload, key);
    if (!message) {
      console.warn("[live] relay: messaggio scartato (firma non valida)");
      return;
    }
    if (message.origin === origin) return;
    for (const handler of handlers) handler(message);
  });
  channel.subscribe((status, error) => {
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      console.error(`[live] relay: canale ${status}`, error);
    }
  });

  return {
    send(message) {
      channel
        .send({
          type: "broadcast",
          event: RELAY_EVENT,
          payload: signRelayMessage({ ...message, origin }, key),
        })
        .catch((error: unknown) =>
          console.error("[live] relay: invio fallito", error),
        );
    },
    onReceive(handler) {
      handlers.push(handler);
    },
  };
}

/**
 * The relay of this deployment: Supabase Realtime when the project URL and
 * the secret key are set, unless `LIVE_RELAY=off`. `null` = one instance.
 */
export function createSupabaseRelay(
  client: SupabaseClient | null,
  secretKey: string | null,
): LiveRelay | null {
  if (!client || !secretKey || process.env.LIVE_RELAY === "off") return null;
  const channel = client.channel(RELAY_CHANNEL, {
    config: { broadcast: { self: false, ack: false } },
  });
  return createBroadcastRelay(
    channel as unknown as BroadcastChannel,
    secretKey,
  );
}
