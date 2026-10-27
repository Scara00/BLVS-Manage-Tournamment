import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminSessionTimer,
  type AdminSessionSnapshot,
} from "./admin-session-timer";

describe("AdminSessionTimer", () => {
  let changes: AdminSessionSnapshot[];
  let onDeadline: ReturnType<typeof vi.fn<() => void>>;
  let timer: AdminSessionTimer;

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "Date", "performance"],
    });
    changes = [];
    onDeadline = vi.fn<() => void>();
    timer = new AdminSessionTimer({
      warningSeconds: 120,
      onChange: (s) => changes.push(s),
      onDeadline,
    });
  });

  afterEach(() => {
    timer.stop();
    vi.useRealTimers();
  });

  const last = () => changes.at(-1);

  it("resta in silenzio fino a 2 minuti dalla scadenza, poi conta ogni secondo", () => {
    timer.start(600);
    expect(last()).toEqual({ phase: "active", secondsLeft: 600 });

    vi.advanceTimersByTime(479_999);
    expect(changes).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(last()).toEqual({ phase: "warning", secondsLeft: 120 });

    vi.advanceTimersByTime(1_000);
    expect(last()).toEqual({ phase: "warning", secondsLeft: 119 });
    vi.advanceTimersByTime(60_000);
    expect(last()).toEqual({ phase: "warning", secondsLeft: 59 });
    expect(onDeadline).not.toHaveBeenCalled();
  });

  it("alla scadenza avvisa una volta sola", () => {
    timer.start(150);
    vi.advanceTimersByTime(150_000);
    expect(last()).toEqual({ phase: "warning", secondsLeft: 0 });
    expect(onDeadline).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(60_000);
    expect(onDeadline).toHaveBeenCalledOnce();
  });

  it("prolungando riparte da capo e chiude l'avviso", () => {
    timer.start(130);
    vi.advanceTimersByTime(20_000);
    expect(last()?.phase).toBe("warning");
    timer.start(600);
    expect(last()).toEqual({ phase: "active", secondsLeft: 600 });
    vi.advanceTimersByTime(400_000);
    expect(last()?.phase).toBe("active");
  });

  it("dopo uno stop non scatta più", () => {
    timer.start(130);
    timer.stop();
    vi.advanceTimersByTime(200_000);
    expect(onDeadline).not.toHaveBeenCalled();
  });
});
