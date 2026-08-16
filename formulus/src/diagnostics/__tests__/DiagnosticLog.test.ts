import {
  appendEvent,
  clearDiagnosticFiles,
  configureDiagnosticLog,
  readRecentEvents,
  resetDiagnosticLogForTests,
} from '../DiagnosticLog';
import { createMemoryFs } from '../memoryFs';
import { MAX_LOG_BYTES } from '../paths';

describe('DiagnosticLog', () => {
  beforeEach(() => {
    resetDiagnosticLogForTests();
    configureDiagnosticLog({
      fs: createMemoryFs(),
      documentDirectoryPath: '/docs',
    });
  });

  it('appends events and returns newest first', async () => {
    await appendEvent({
      ts: '2026-08-16T10:00:00.000Z',
      kind: 'log',
      level: 'info',
      tag: 'sync',
      message: 'start',
    });
    await appendEvent({
      ts: '2026-08-16T10:00:01.000Z',
      kind: 'log',
      level: 'info',
      tag: 'sync',
      message: 'done',
    });
    const recent = await readRecentEvents(10);
    expect(recent.map(e => e.message)).toEqual(['done', 'start']);
  });

  it('rotates when the file would exceed the size cap', async () => {
    const fs = createMemoryFs();
    configureDiagnosticLog({ fs, documentDirectoryPath: '/docs' });
    const huge = 'x'.repeat(MAX_LOG_BYTES - 20);
    await appendEvent({
      ts: '2026-08-16T10:00:00.000Z',
      kind: 'log',
      level: 'info',
      tag: 'sync',
      message: huge,
    });
    await appendEvent({
      ts: '2026-08-16T10:00:01.000Z',
      kind: 'log',
      level: 'info',
      tag: 'sync',
      message: 'overflow',
    });
    expect(await fs.exists('/docs/diagnostics/events.ndjson.1')).toBe(true);
    const recent = await readRecentEvents(5);
    expect(recent[0].message).toBe('overflow');
  });

  it('clears event and exit files', async () => {
    await appendEvent({
      ts: '2026-08-16T10:00:00.000Z',
      kind: 'log',
      level: 'info',
      tag: 'sync',
      message: 'start',
    });
    await clearDiagnosticFiles();
    expect(await readRecentEvents(10)).toEqual([]);
  });
});
