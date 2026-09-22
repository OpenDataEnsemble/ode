/** All callers (debounce, native flush, camera) wait for earlier refresh/save work. */
export class DraftFlushQueue {
  private tail: Promise<void> = Promise.resolve();

  run(work: () => Promise<void>): Promise<void> {
    const result = this.tail.then(work);
    // A failed write is reported to its caller, but must not poison retries.
    this.tail = result.catch(() => {});
    return result;
  }
}
