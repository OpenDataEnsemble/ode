/** All callers (debounce, native flush, camera) wait for earlier refresh/save work. */
export class DraftFlushQueue {
  private tail: Promise<void> = Promise.resolve();
  private epoch = 0;

  run(work: () => Promise<void>): Promise<void> {
    const result = this.tail.then(work);
    // A failed write is reported to its caller, but must not poison retries.
    this.tail = result.catch(() => {});
    return result;
  }

  /** Resolves once every previously queued refresh/save has settled. */
  settled(): Promise<void> {
    return this.tail;
  }

  /** Identifies the draft session whose writes are currently permitted. */
  currentEpoch(): number {
    return this.epoch;
  }

  /**
   * Retire the current session: a refresh started before this call must not
   * write a draft afterwards (e.g. after a successful submit deleted it).
   */
  retire(): number {
    this.epoch += 1;
    return this.epoch;
  }

  isCurrent(epoch: number): boolean {
    return epoch === this.epoch;
  }
}
