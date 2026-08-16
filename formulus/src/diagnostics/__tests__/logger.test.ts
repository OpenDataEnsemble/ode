import { configureDiagnosticLog, readRecentEvents } from '../DiagnosticLog';
import {
  configureLogger,
  logger,
  persistWebViewConsole,
  resetLoggerForTests,
} from '../logger';
import { createMemoryFs } from '../memoryFs';

describe('logger', () => {
  const consoleMock = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    resetLoggerForTests();
    configureLogger({ console: consoleMock, persist: true });
    configureDiagnosticLog({
      fs: createMemoryFs(),
      documentDirectoryPath: '/docs',
    });
    consoleMock.debug.mockClear();
    consoleMock.info.mockClear();
    consoleMock.warn.mockClear();
    consoleMock.error.mockClear();
  });

  it('does not persist debug lines', async () => {
    logger.debug('sync', 'looking up observation');
    await logger.breadcrumb('sync', 'start', { counts: 3 });
    const events = await readRecentEvents(10);
    expect(events.some(e => e.level === 'debug')).toBe(false);
    expect(events.some(e => e.kind === 'breadcrumb')).toBe(true);
  });

  it('persists info after redaction and drops unknown extras', async () => {
    logger.info('sync', 'Bearer super-secret-token pull done', {
      counts: 4,
      // @ts-expect-error intentional leak attempt
      observationId: 'obs-1',
    });
    // allow async persist
    await new Promise(resolve => setTimeout(resolve, 0));
    const events = await readRecentEvents(5);
    expect(events[0].message).toContain('[redacted]');
    expect(events[0].message).not.toContain('super-secret-token');
    expect(events[0].extras).toEqual({ counts: 4 });
  });

  it('persists webview warn/error but not debug', async () => {
    persistWebViewConsole('webview', 'debug', ['noisy']);
    persistWebViewConsole('webview', 'error', ['boom', { data: { n: 1 } }]);
    await new Promise(resolve => setTimeout(resolve, 0));
    const events = await readRecentEvents(10);
    expect(events.some(e => e.message.includes('noisy'))).toBe(false);
    expect(events.some(e => e.level === 'error')).toBe(true);
    expect(events[0].message).not.toContain('data');
  });
});
