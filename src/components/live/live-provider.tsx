"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import {
  createLiveConnection,
  type LiveConnectionOptions,
  type LiveStatus,
} from "@/lib/live/client/live-connection";
import {
  applyLiveEvent,
  type LiveEvent,
  type LiveSnapshot,
  type LiveSync,
} from "@/lib/live/types";

export type LiveState = {
  snapshot: LiveSnapshot;
  status: LiveStatus;
  /** ISO time the data was last confirmed current (event, resync or ping). */
  freshAt: string;
};

type Action =
  | { type: "sync"; sync: LiveSync }
  | { type: "event"; event: LiveEvent }
  | { type: "ping"; at: string }
  | { type: "status"; status: LiveStatus };

function reducer(state: LiveState, action: Action): LiveState {
  switch (action.type) {
    case "sync":
      return {
        ...state,
        snapshot: action.sync.snapshot,
        freshAt: action.sync.syncedAt,
      };
    case "event":
      return {
        ...state,
        snapshot: applyLiveEvent(state.snapshot, action.event),
        freshAt: action.event.savedAt,
      };
    case "ping":
      return action.at > state.freshAt
        ? { ...state, freshAt: action.at }
        : state;
    case "status":
      return { ...state, status: action.status };
  }
}

type EventListener = (event: LiveEvent) => void;

type LiveContextValue = LiveState & {
  /** Every applied event, for the announcer. Returns the unsubscribe. */
  subscribeEvents: (listener: EventListener) => () => void;
};

const LiveContext = createContext<LiveContextValue | null>(null);

/**
 * Holds the live data of a page: starts from the server-rendered snapshot,
 * then keeps it current over the SSE channel. `connection` overrides the
 * transport (tests); `connect={false}` renders the snapshot only (stories).
 */
export function LiveProvider({
  initial,
  connect = true,
  initialStatus = "connecting",
  connection,
  children,
}: {
  initial: LiveSync;
  connect?: boolean;
  /** Status shown before the connection reports one (stories). */
  initialStatus?: LiveStatus;
  connection?: Partial<LiveConnectionOptions>;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, {
    snapshot: initial.snapshot,
    freshAt: initial.syncedAt,
    status: initialStatus,
  });
  const listeners = useRef(new Set<EventListener>());
  const options = useRef(connection);
  const initialSeq = useRef(initial.snapshot.seq);

  useEffect(() => {
    if (!connect) return;
    const live = createLiveConnection({
      initialSeq: initialSeq.current,
      ...options.current,
      onStatus: (status) => dispatch({ type: "status", status }),
      onSync: (sync) => dispatch({ type: "sync", sync }),
      onPing: (at) => dispatch({ type: "ping", at }),
      onEvent: (event) => {
        dispatch({ type: "event", event });
        for (const listener of listeners.current) listener(event);
      },
    });
    live.start();
    return () => live.stop();
  }, [connect]);

  const subscribeEvents = useCallback((listener: EventListener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value = useMemo<LiveContextValue>(
    () => ({ ...state, subscribeEvents }),
    [state, subscribeEvents],
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive(): LiveContextValue {
  const value = useContext(LiveContext);
  if (!value) throw new Error("useLive() va usato dentro <LiveProvider>.");
  return value;
}
