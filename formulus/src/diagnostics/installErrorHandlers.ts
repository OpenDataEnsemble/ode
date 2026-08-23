import { appendEvent } from './DiagnosticLog';
import { redactText } from './redact';

/** Stacks are longer than log messages; keep enough frames to be useful. */
export const STACK_MESSAGE_MAX = 4000;
/** Never let a stalled write hold the crash open indefinitely. */
const FLUSH_TIMEOUT_MS = 1500;

type ErrorUtilsLike = {
  getGlobalHandler?: () =>
    | ((error: Error, isFatal?: boolean) => void)
    | undefined;
  setGlobalHandler: (
    handler: (error: Error, isFatal?: boolean) => void,
  ) => void;
};

function messageWithStack(value: unknown): string {
  if (value instanceof Error) {
    return value.stack || value.message || value.name;
  }
  return String(value);
}

function flushFatal(
  kind: 'js_fatal' | 'js_unhandled',
  value: unknown,
): Promise<void> {
  return appendEvent({
    ts: new Date().toISOString(),
    kind,
    level: 'error',
    tag: 'js',
    message: redactText(messageWithStack(value), STACK_MESSAGE_MAX),
  }).catch(() => {
    /* Persistence must never mask the original error. */
  });
}

export function installErrorHandlers(): void {
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (errorUtils?.setGlobalHandler) {
    const previous = errorUtils.getGlobalHandler?.();
    errorUtils.setGlobalHandler((error, isFatal) => {
      // Delay handing the fatal to the default handler (which crashes the
      // process) until the append has landed, so the stack survives the exit —
      // but never wait longer than FLUSH_TIMEOUT_MS if the write stalls.
      let done = false;
      const crash = () => {
        if (done) {
          return;
        }
        done = true;
        clearTimeout(timer);
        previous?.(error, isFatal);
      };
      const timer = setTimeout(crash, FLUSH_TIMEOUT_MS);
      (timer as { unref?: () => void }).unref?.();
      void flushFatal('js_fatal', error).finally(crash);
    });
  }

  const target = globalThis as unknown as {
    addEventListener?: (
      type: string,
      listener: (event: { reason?: unknown }) => void,
    ) => void;
  };
  if (typeof target.addEventListener === 'function') {
    target.addEventListener('unhandledrejection', event => {
      void flushFatal('js_unhandled', event?.reason ?? 'rejection');
    });
  }
}
