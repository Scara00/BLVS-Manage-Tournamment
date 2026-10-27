/** What the admin session timer shows right now. */
export type AdminSessionSnapshot = {
  /** `warning` inside the last `warningSeconds`, `active` before. */
  phase: "active" | "warning";
  /** Whole seconds left. */
  secondsLeft: number;
};

type Options = {
  warningSeconds: number;
  onChange: (snapshot: AdminSessionSnapshot) => void;
  /** The deadline was reached. */
  onDeadline: () => void;
  /** Monotonic clock in ms; immune to the wall clock being changed. */
  clock?: () => number;
};

/**
 * Counts down to the admin session deadline. Before the warning it waits
 * with a single timeout; inside the warning it ticks on every whole second.
 * Every tick recomputes from the deadline, so a throttled tab or a laptop
 * that slept catches up on the next tick (or on `refresh()`).
 */
export class AdminSessionTimer {
  private deadline: number | null = null;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private readonly options: Options;
  private readonly clock: () => number;

  constructor(options: Options) {
    this.options = options;
    this.clock = options.clock ?? (() => performance.now());
  }

  /** (Re)starts the countdown: `seconds` from now. */
  start(seconds: number): void {
    this.deadline = this.clock() + seconds * 1000;
    this.refresh();
  }

  stop(): void {
    clearTimeout(this.timeout);
    this.deadline = null;
  }

  /** Recomputes the state now (e.g. when the tab becomes visible again). */
  refresh = (): void => {
    clearTimeout(this.timeout);
    if (this.deadline === null) return;
    const left = this.deadline - this.clock();
    const { warningSeconds, onChange, onDeadline } = this.options;

    if (left <= 0) {
      this.deadline = null;
      onChange({ phase: "warning", secondsLeft: 0 });
      onDeadline();
      return;
    }
    const secondsLeft = Math.ceil(left / 1000);
    const warningMs = warningSeconds * 1000;
    if (left > warningMs) {
      onChange({ phase: "active", secondsLeft });
      this.timeout = setTimeout(this.refresh, left - warningMs);
      return;
    }
    onChange({ phase: "warning", secondsLeft });
    // Wake up when the displayed second changes.
    this.timeout = setTimeout(this.refresh, left - (secondsLeft - 1) * 1000);
  };
}
