import { appendEvent } from './DiagnosticLog';
import {
  joinLogArgs,
  pickAllowedExtras,
  redactText,
  WEBVIEW_INFO_MESSAGE_MAX,
} from './redact';
import type { AllowedLogExtras, LogLevel } from './types';

const WEBVIEW_INFO_WINDOW_MS = 10_000;
const WEBVIEW_INFO_MAX_PER_WINDOW = 20;

let webViewInfoTimes: number[] = [];

type ConsoleLike = {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

let consoleSink: ConsoleLike = console;
let persistEnabled = true;

export function configureLogger(options: {
  console?: ConsoleLike;
  persist?: boolean;
}): void {
  if (options.console) {
    consoleSink = options.console;
  }
  if (options.persist != null) {
    persistEnabled = options.persist;
  }
}

export function resetLoggerForTests(): void {
  consoleSink = console;
  persistEnabled = true;
  webViewInfoTimes = [];
}

function formatPrefix(level: LogLevel, tag: string, message: string): string {
  return `[${tag}] ${message}`;
}

async function persist(
  level: LogLevel | 'breadcrumb',
  tag: string,
  message: string,
  extras?: AllowedLogExtras,
  breadcrumb?: { category: string; action: string },
): Promise<void> {
  if (!persistEnabled) {
    return;
  }
  try {
    await appendEvent({
      ts: new Date().toISOString(),
      kind: breadcrumb ? 'breadcrumb' : 'log',
      level,
      tag,
      message: redactText(message),
      extras: pickAllowedExtras(extras),
      category: breadcrumb?.category,
      action: breadcrumb?.action,
    });
  } catch {
    // Persistence must never break the caller.
  }
}

function emit(
  level: LogLevel,
  tag: string,
  message: string,
  extras?: AllowedLogExtras,
): void {
  const line = formatPrefix(level, tag, message);
  if (extras) {
    consoleSink[level](line, extras);
  } else {
    consoleSink[level](line);
  }
  if (level !== 'debug') {
    void persist(level, tag, message, extras);
  }
}

export const logger = {
  debug(tag: string, message: string, extras?: AllowedLogExtras): void {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      emit('debug', tag, message, extras);
    }
  },

  info(tag: string, message: string, extras?: AllowedLogExtras): void {
    emit('info', tag, message, extras);
  },

  warn(tag: string, message: string, extras?: AllowedLogExtras): void {
    emit('warn', tag, message, extras);
  },

  error(tag: string, message: string, extras?: AllowedLogExtras): void {
    emit('error', tag, message, extras);
  },

  async breadcrumb(
    category: string,
    action: string,
    extras?: AllowedLogExtras,
  ): Promise<void> {
    const message = `${category}.${action}`;
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      consoleSink.info(`[breadcrumb] ${message}`, extras ?? '');
    }
    await persist('breadcrumb', category, message, extras, {
      category,
      action,
    });
  },
};

function allowWebViewInfo(): boolean {
  const now = Date.now();
  webViewInfoTimes = webViewInfoTimes.filter(
    t => now - t < WEBVIEW_INFO_WINDOW_MS,
  );
  if (webViewInfoTimes.length >= WEBVIEW_INFO_MAX_PER_WINDOW) {
    return false;
  }
  webViewInfoTimes.push(now);
  return true;
}

export function persistWebViewConsole(
  tag: string,
  level: string,
  args: unknown[],
): void {
  const joined = joinLogArgs(args);
  if (level === 'debug') {
    return;
  }
  if (level === 'warn' || level === 'error') {
    logger[level](tag, joined);
    return;
  }
  if (!allowWebViewInfo()) {
    return;
  }
  logger.info(tag, redactText(joined, WEBVIEW_INFO_MESSAGE_MAX));
}

export function webViewTag(appName?: string): string {
  const name = (appName ?? '').toLowerCase();
  if (name.includes('formplayer')) {
    return 'webview:formplayer';
  }
  return name ? `webview:${name}` : 'webview';
}
