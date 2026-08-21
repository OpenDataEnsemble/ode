import {
  composeWithUi,
  isControl,
  isVisible,
  Resolve,
  type UISchemaElement,
} from '@jsonforms/core';
import type Ajv from 'ajv';
import {
  mergePreservingSubObsArrays,
  omitDataPath,
} from '../renderers/subObservationHelpers';

type WalkEl = UISchemaElement & {
  type?: string;
  elements?: UISchemaElement[];
  scope?: string;
};

/** True when a value (including stale `null` clears) should be stripped for a hidden Control. */
function hasPresentHiddenValue(data: unknown): boolean {
  // Missing key → undefined. Stale null/'' from older clear-on-hide builds still strip.
  return data !== undefined;
}

/**
 * Omit every Control that is not visible under current data (including Controls
 * nested under a hidden Group/page), even if those Controls are not currently
 * mounted (SwipeLayout / FlatGroup early-return).
 *
 * Deletes keys (unanswered) — do not write `null`, which AJV reports as
 * "Invalid value" for typed schemas.
 */
export function clearHiddenControlData(
  data: Record<string, unknown>,
  uischema: UISchemaElement | null | undefined,
  ajv: Ajv | undefined,
  config: unknown = {},
  dispatchPath = '',
): Record<string, unknown> {
  if (!uischema || !ajv) return data;

  let next = data;
  let changed = false;

  const omitHidden = (controlPath: string, current: unknown) => {
    if (!hasPresentHiddenValue(current)) return;
    if (!changed) {
      next = { ...data };
      changed = true;
    }
    next = omitDataPath(next, controlPath);
  };

  const visit = (element: WalkEl, path: string, ancestorVisible: boolean) => {
    const selfVisible =
      ancestorVisible && isVisible(element, data, path, ajv, config);

    if (isControl(element)) {
      if (!selfVisible) {
        const controlPath = composeWithUi(element, path);
        if (controlPath) {
          omitHidden(controlPath, Resolve.data(next, controlPath));
        }
      }
      return;
    }

    const children = element.elements;
    if (!Array.isArray(children) || children.length === 0) {
      return;
    }

    for (const child of children) {
      visit(child as WalkEl, path, selfVisible);
    }
  };

  visit(uischema as WalkEl, dispatchPath, true);
  return next;
}

export type MergeIncomingFormDataOptions = {
  uischema?: UISchemaElement | null;
  ajv?: Ajv;
  config?: unknown;
};

/**
 * SwipeLayout-safe data update: preserve off-page baseline fields, then omit
 * answers that SHOW/HIDE says are not relevant.
 *
 * This is the App `onChange` entry point — keeps clear-on-hide (key deletion /
 * unanswered) compatible with {@link mergePreservingSubObsArrays} without a
 * `null` sentinel that breaks AJV.
 */
export function mergeIncomingFormData(
  baseline: Record<string, unknown>,
  incoming: Record<string, unknown>,
  options: MergeIncomingFormDataOptions = {},
): Record<string, unknown> {
  const merged = mergePreservingSubObsArrays(baseline, incoming);
  return clearHiddenControlData(
    merged,
    options.uischema,
    options.ajv,
    options.config,
  );
}
