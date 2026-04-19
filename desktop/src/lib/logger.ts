type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const DEFAULT_LEVEL: LogLevel = import.meta.env.DEV ? 'debug' : 'info';
const GLOBAL_LEVEL_KEY = 'custodian.log_level';

function getConfiguredLevel(): LogLevel {
  if (typeof window === 'undefined') {
    return DEFAULT_LEVEL;
  }
  const stored = window.localStorage.getItem(GLOBAL_LEVEL_KEY);
  if (
    stored === 'debug' ||
    stored === 'info' ||
    stored === 'warn' ||
    stored === 'error'
  ) {
    return stored;
  }
  return DEFAULT_LEVEL;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[getConfiguredLevel()];
}

function toIsoNow(): string {
  return new Date().toISOString();
}

export function createLogger(scope: string) {
  function log(level: LogLevel, message: string, context?: unknown) {
    if (!shouldLog(level)) {
      return;
    }
    const prefix = `[${toIsoNow()}] [${level.toUpperCase()}] [${scope}]`;
    const consoleMethod =
      level === 'debug'
        ? console.debug
        : level === 'info'
          ? console.info
          : level === 'warn'
            ? console.warn
            : console.error;

    if (context === undefined) {
      consoleMethod(prefix, message);
    } else {
      consoleMethod(prefix, message, context);
    }
  }

  return {
    debug: (message: string, context?: unknown) =>
      log('debug', message, context),
    info: (message: string, context?: unknown) => log('info', message, context),
    warn: (message: string, context?: unknown) => log('warn', message, context),
    error: (message: string, context?: unknown) =>
      log('error', message, context),
  };
}
