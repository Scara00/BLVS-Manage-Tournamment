/**
 * Drops events the client has already applied: replays that overlap the
 * resync snapshot, or the same event delivered twice. Events carry a
 * monotonic `seq`, so "seen" is anything at or below the last accepted one.
 */
export function createDeduper(initialSeq = 0) {
  let last = initialSeq;
  return {
    /** True the first time a `seq` beyond the last accepted one is offered. */
    accept(seq: number): boolean {
      if (seq <= last) return false;
      last = seq;
      return true;
    },
    /** After a full resync: the snapshot's `seq` is the new baseline. */
    reset(seq: number) {
      last = seq;
    },
    get lastSeq() {
      return last;
    },
  };
}
