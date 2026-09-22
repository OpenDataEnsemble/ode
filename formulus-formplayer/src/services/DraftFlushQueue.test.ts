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
