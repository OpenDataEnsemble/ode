import { appendEvent } from './DiagnosticLog';
import { redactText } from './redact';

type ErrorUtilsLike = {
  getGlobalHandler?: () =>
    | ((error: Error, isFatal?: boolean) => void)
    | undefined;
  setGlobalHandler: (
    handler: (error: Error, isFatal?: boolean) => void,
  ) => void;
};

function persistFatal(
  kind: 'js_fatal' | 'js_unhandled',
  message: string,
): void {
  void appendEvent({
    ts: new Date().toISOString(),
    kind,
    level: 'error',
    tag: 'js',
    message: redactText(message),
  }).catch(() => {
    /* ignore */
  });
}

export function installErrorHandlers(): void {
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (errorUtils?.setGlobalHandler) {
    const previous = errorUtils.getGlobalHandler?.();
    errorUtils.setGlobalHandler((error, isFatal) => {
      persistFatal(
        'js_fatal',
        error instanceof Error ? error.message : String(error),
      );
      previous?.(error, isFatal);
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
      const reason = event?.reason;
      persistFatal(
        'js_unhandled',
        reason instanceof Error
          ? reason.message
          : String(reason ?? 'rejection'),
      );
    });
  }
}
