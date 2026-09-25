import { profileActivity } from '../profiles/ProfileActivity';

type HandlerMap<T> = { [K in keyof T]: (...args: never[]) => unknown };
export type TrackedHandlers<T extends HandlerMap<T>> = {
  [K in keyof T]: (
    ...args: Parameters<T[K]>
  ) => Promise<Awaited<ReturnType<T[K]>>>;
};

/** Gate before invoking handlers, outside their error-to-result conversions. */
export function trackProfileHandlers<T extends HandlerMap<T>>(
  handlers: T,
): TrackedHandlers<T> {
  return Object.fromEntries(
    Object.entries(handlers).map(([name, handler]) => [
      name,
      (...args: unknown[]) =>
        profileActivity.run(`WebView: ${name}`, async () =>
          (handler as (...values: unknown[]) => unknown)(...args),
        ),
    ]),
  ) as unknown as TrackedHandlers<T>;
}
