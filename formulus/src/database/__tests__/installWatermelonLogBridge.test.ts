import watermelonLogger from '@nozbe/watermelondb/utils/common/logger';
import {
  configureDiagnosticLog,
  readRecentEvents,
} from '../../diagnostics/DiagnosticLog';
import { configureLogger, resetLoggerForTests } from '../../diagnostics/logger';
import { createMemoryFs } from '../../diagnostics/memoryFs';
import {
  installWatermelonLogBridge,
  resetWatermelonLogBridgeForTests,
} from '../installWatermelonLogBridge';

describe('installWatermelonLogBridge', () => {
  beforeEach(() => {
    resetWatermelonLogBridgeForTests();
    resetLoggerForTests();
    configureLogger({ persist: true });
    configureDiagnosticLog({
      fs: createMemoryFs(),
      documentDirectoryPath: '/docs',
    });
  });

  afterEach(() => {
    resetWatermelonLogBridgeForTests();
  });

  it('persists Watermelon warn and error into the diagnostic log', async () => {
    installWatermelonLogBridge();
    watermelonLogger.warn('JSI SQLiteAdapter not available… falling back');
    watermelonLogger.error(new Error('Failed to initialize JSI'));
    await new Promise(resolve => setTimeout(resolve, 0));
    const events = await readRecentEvents(10);
    expect(
      events.some(
        e =>
          e.tag === 'watermelon' &&
          e.level === 'warn' &&
          e.message.includes('JSI SQLiteAdapter not available'),
      ),
    ).toBe(true);
    expect(
      events.some(
        e =>
          e.tag === 'watermelon' &&
          e.level === 'error' &&
          e.message.includes('Failed to initialize JSI'),
      ),
    ).toBe(true);
  });

  it('is idempotent', () => {
    installWatermelonLogBridge();
    installWatermelonLogBridge();
    expect(() => watermelonLogger.warn('once')).not.toThrow();
  });
});
