import { useEffect } from 'react';

export type ClearOnHideHandleChange = (path: string, value: unknown) => void;

export type UseClearOnHideArgs = {
  visible?: boolean;
  path?: string;
  data?: unknown;
  handleChange?: ClearOnHideHandleChange;
};

/** True when the control holds a value worth clearing on hide. */
export function hasClearableValue(data: unknown): boolean {
  if (data === undefined || data === null || data === '') return false;
  if (Array.isArray(data) && data.length === 0) return false;
  return true;
}

/**
 * When JsonForms marks a control `visible: false` (SHOW/HIDE), clear its value
 * so dependent relevance rules re-evaluate (ODK-style `relevant` behaviour).
 *
 * Formplayer policy: this is the default (and only) behaviour for Controls —
 * applied via {@link applyClearOnHideToRenderers} on the renderer registry and
 * also called from individual control shells for defense in depth.
 *
 * Safe to call on every render: no-ops when already empty or when handleChange/path
 * are missing (e.g. simple withVisibleGuard demos).
 */
export function useClearOnHide({
  visible,
  path,
  data,
  handleChange,
}: UseClearOnHideArgs): void {
  useEffect(() => {
    if (visible !== false) return;
    if (!path || typeof handleChange !== 'function') return;
    if (!hasClearableValue(data)) return;
    handleChange(path, undefined);
  }, [visible, path, data, handleChange]);
}
