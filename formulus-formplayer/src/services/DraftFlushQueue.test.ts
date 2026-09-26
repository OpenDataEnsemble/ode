import { describe, expect, it } from 'vitest';
import { DraftFlushQueue } from './DraftFlushQueue';

describe('acknowledged draft flush ordering', () => {
  it('waits for an already-running refresh and storage write before acknowledging', async () => {
    const queue = new DraftFlushQueue();
    let finish!: () => void;
    const refresh = new Promise<void>(resolve => {
      finish = resolve;
    });
    const events: string[] = [];
    const debounce = queue.run(async () => {
      events.push('refresh');
      await refresh;
      events.push('saved');
    });
    const ack = queue.run(async () => {
      events.push('ack');
    });
    await Promise.resolve();
    expect(events).toEqual(['refresh']);
    finish();
    await Promise.all([debounce, ack]);
    expect(events).toEqual(['refresh', 'saved', 'ack']);
  });

  it('retires a session so a refresh started before submit cannot write afterwards', async () => {
    const queue = new DraftFlushQueue();
    const writes: string[] = [];
    let finishRefresh!: () => void;
    const refresh = new Promise<void>(resolve => {
      finishRefresh = resolve;
    });
    const persist = (label: string, epoch: number) => {
      if (queue.isCurrent(epoch)) writes.push(label);
    };
    const inFlight = queue.run(async () => {
      const epoch = queue.currentEpoch();
      await refresh;
      persist('stale-refresh', epoch);
    });
    // Let the refresh start (and capture its epoch) before the submit lands.
    await Promise.resolve();
    // Successful submit: retire, wait for the in-flight refresh, then delete.
    queue.retire();
    const submit = queue.settled().then(() => writes.push('deleted'));
    finishRefresh();
    await Promise.all([inFlight, submit]);
    expect(writes).toEqual(['deleted']);
    // A refresh in a new session still persists.
    await queue.run(async () => persist('fresh', queue.currentEpoch()));
    expect(writes).toEqual(['deleted', 'fresh']);
  });

  it('does not run a pre-submit queued flush under the next epoch', async () => {
    const queue = new DraftFlushQueue();
    const writes: string[] = [];
    let finish!: () => void;
    const blocker = queue.run(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        }),
    );
    const epoch = queue.currentEpoch();
    const queued = queue.run(async () => {
      if (queue.isCurrent(epoch)) writes.push('queued-draft');
    });
    await Promise.resolve();
    queue.retire();
    const deletion = queue.settled().then(() => writes.push('deleted'));
    finish();
    await Promise.all([blocker, queued, deletion]);
    expect(writes).toEqual(['deleted']);
  });

  it('invalidates prior work again when a new form session starts', async () => {
    const queue = new DraftFlushQueue();
    const oldEpoch = queue.currentEpoch();
    queue.retire(); // Successful submit.
    queue.retire(); // A new form initializes in the same document.
    expect(queue.isCurrent(oldEpoch)).toBe(false);
    const newEpoch = queue.currentEpoch();
    expect(queue.isCurrent(newEpoch)).toBe(true);
    queue.retire();
    expect(queue.isCurrent(newEpoch)).toBe(false);
  });

  it('rejects on storage failure without poisoning a later retry', async () => {
    const queue = new DraftFlushQueue();
    await expect(
      queue.run(async () => {
        throw new Error('quota');
      }),
    ).rejects.toThrow('quota');
    await expect(queue.run(async () => {})).resolves.toBeUndefined();
  });
});
