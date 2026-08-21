import watermelonLogger from '@nozbe/watermelondb/utils/common/logger';
import { joinLogArgs } from '../diagnostics/redact';
import { logger } from '../diagnostics/logger';

type WatermelonLogger = {
  silent: boolean;
  warn: (...messages: unknown[]) => void;
  error: (...messages: unknown[]) => void;
};

const wmLogger = watermelonLogger as WatermelonLogger;

let installed = false;
let originalWarn: WatermelonLogger['warn'] | undefined;
let originalError: WatermelonLogger['error'] | undefined;

function formatWatermelonArgs(messages: unknown[]): string {
  const normalized = messages.map(message =>
    message instanceof Error ? message.message || String(message) : message,
  );
  return joinLogArgs(normalized);
}

function persist(level: 'warn' | 'error', messages: unknown[]): void {
  if (wmLogger.silent) {
    return;
  }
  const text = formatWatermelonArgs(messages);
  if (!text) {
    return;
  }
  logger[level]('watermelon', text);
}

/**
 * WatermelonDB logs JSI fallback and native errors to console only. Mirror
 * warn/error into the Formulus diagnostic log so field exports include them.
 *
 * Must run before `new SQLiteAdapter({ jsi: true })`, which is when the
 * fallback warning is emitted.
 */
export function installWatermelonLogBridge(): void {
  if (installed) {
    return;
  }
  originalWarn = wmLogger.warn.bind(wmLogger);
  originalError = wmLogger.error.bind(wmLogger);
  wmLogger.warn = (...messages: unknown[]) => {
    originalWarn?.(...messages);
    persist('warn', messages);
  };
  wmLogger.error = (...messages: unknown[]) => {
    originalError?.(...messages);
    persist('error', messages);
  };
  installed = true;
}

export function resetWatermelonLogBridgeForTests(): void {
  if (!installed) {
    return;
  }
  if (originalWarn) {
    wmLogger.warn = originalWarn;
  }
  if (originalError) {
    wmLogger.error = originalError;
  }
  originalWarn = undefined;
  originalError = undefined;
  installed = false;
}
