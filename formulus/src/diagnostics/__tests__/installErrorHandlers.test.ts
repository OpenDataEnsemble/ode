import { installErrorHandlers } from '../installErrorHandlers';
import { appendEvent } from '../DiagnosticLog';

jest.mock('../DiagnosticLog', () => ({
  appendEvent: jest.fn().mockResolvedValue(undefined),
}));

const flushMicrotasks = () =>
  new Promise<void>(resolve => setImmediate(resolve));

type GlobalWithHandlers = typeof globalThis & {
  ErrorUtils?: unknown;
  addEventListener?: unknown;
};

describe('installErrorHandlers', () => {
  const globalRef = globalThis as GlobalWithHandlers;
  const originalErrorUtils = globalRef.ErrorUtils;
  const originalAddEventListener = globalRef.addEventListener;

  let fatalHandler: ((error: Error, isFatal?: boolean) => void) | undefined;
  let previous: jest.Mock;

  beforeEach(() => {
    (appendEvent as jest.Mock).mockClear();
    previous = jest.fn();
    fatalHandler = undefined;
    globalRef.ErrorUtils = {
      getGlobalHandler: () => previous,
      setGlobalHandler: (
        handler: (error: Error, isFatal?: boolean) => void,
      ) => {
        fatalHandler = handler;
      },
    };
    delete globalRef.addEventListener;
  });

  afterEach(() => {
    globalRef.ErrorUtils = originalErrorUtils;
    globalRef.addEventListener = originalAddEventListener;
  });

  it('persists the stack and only crashes after the flush lands', async () => {
    installErrorHandlers();
    const error = new Error('boom');

    fatalHandler?.(error, true);
    // The default (crashing) handler must not run before the append resolves.
    expect(previous).not.toHaveBeenCalled();

    await flushMicrotasks();

    expect(appendEvent).toHaveBeenCalledTimes(1);
    const event = (appendEvent as jest.Mock).mock.calls[0][0];
    expect(event.kind).toBe('js_fatal');
    expect(event.message).toContain('boom');
    expect(previous).toHaveBeenCalledWith(error, true);
  });

  it('records the stack of an unhandled rejection', async () => {
    let rejectionListener: ((event: { reason?: unknown }) => void) | undefined;
    globalRef.addEventListener = (
      type: string,
      listener: (event: { reason?: unknown }) => void,
    ) => {
      if (type === 'unhandledrejection') {
        rejectionListener = listener;
      }
    };

    installErrorHandlers();
    rejectionListener?.({ reason: new Error('async boom') });

    await flushMicrotasks();

    expect(appendEvent).toHaveBeenCalledTimes(1);
    const event = (appendEvent as jest.Mock).mock.calls[0][0];
    expect(event.kind).toBe('js_unhandled');
    expect(event.message).toContain('async boom');
  });
});
