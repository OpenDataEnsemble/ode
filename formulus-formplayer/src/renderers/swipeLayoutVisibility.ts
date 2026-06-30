import type Ajv from 'ajv';
import { isControl, isVisible, type UISchemaElement } from '@jsonforms/core';

/**
 * Same visibility semantics as JsonForms renderers (see mapStateToControlProps /
 * mapStateToLayoutProps): `dispatchPath` is the path from the parent JsonFormsDispatch,
 * not the composed data path.
 */
export function jsonFormsIsVisible(
  element: UISchemaElement,
  rootData: unknown,
  dispatchPath: string,
  ajv: Ajv,
  config: unknown,
): boolean {
  return isVisible(element, rootData, dispatchPath, ajv, config);
}

/**
 * Material layout renderers pass the same `path` to every child
 * (see @jsonforms/material-renderers `renderLayoutElements`).
 * Array / detail layouts may differ; extend here if formplayer adds those inside swipe pages.
 */
export function dispatchPathForLayoutChild(parentDispatchPath: string): string {
  return parentDispatchPath ?? '';
}

function isVisibleLeafContent(
  element: UISchemaElement,
  rootData: unknown,
  dispatchPath: string,
  ajv: Ajv,
  config: unknown,
): boolean {
  if (!jsonFormsIsVisible(element, rootData, dispatchPath, ajv, config)) {
    return false;
  }
  if (isControl(element)) {
    return true;
  }
  if ((element as { type?: string }).type === 'Label') {
    return true;
  }
  return false;
}

function subtreeHasVisiblePageContent(
  element: UISchemaElement,
  rootData: unknown,
  dispatchPath: string,
  ajv: Ajv,
  config: unknown,
): boolean {
  if (isVisibleLeafContent(element, rootData, dispatchPath, ajv, config)) {
    return true;
  }
  if (!jsonFormsIsVisible(element, rootData, dispatchPath, ajv, config)) {
    return false;
  }
  const children = (element as { elements?: UISchemaElement[] }).elements;
  if (!Array.isArray(children) || children.length === 0) {
    return false;
  }
  const childPath = dispatchPathForLayoutChild(dispatchPath);
  for (const child of children) {
    if (subtreeHasVisiblePageContent(child, rootData, childPath, ajv, config)) {
      return true;
    }
  }
  return false;
}

/**
 * Whether a swipe "screen" should participate in next/prev/progress.
 * - Finalize is always included (matches legacy SwipeLayout behavior).
 * - Label-only screens count as visible page content; nested Groups are walked.
 */
export function pageIsVisibleInSwipe(
  page: UISchemaElement,
  rootData: unknown,
  dispatchPath: string,
  ajv: Ajv,
  config: unknown,
): boolean {
  if (!page) {
    return false;
  }
  const typed = page as { type?: string; elements?: UISchemaElement[] };

  if (typed.type === 'Finalize') {
    return true;
  }

  if (!jsonFormsIsVisible(page, rootData, dispatchPath, ajv, config)) {
    return false;
  }

  if (isControl(page)) {
    return true;
  }

  if (!typed.elements || typed.elements.length === 0) {
    return true;
  }

  const childPath = dispatchPathForLayoutChild(dispatchPath);
  return typed.elements.some(child =>
    subtreeHasVisiblePageContent(child, rootData, childPath, ajv, config),
  );
}

export function visiblePageIndicesFromLayouts(
  layouts: UISchemaElement[],
  rootData: unknown,
  swipeDispatchPath: string,
  ajv: Ajv,
  config: unknown,
): number[] {
  return layouts
    .map((_, idx) => idx)
    .filter(idx =>
      pageIsVisibleInSwipe(
        layouts[idx],
        rootData,
        swipeDispatchPath,
        ajv,
        config,
      ),
    );
}

/** Depth-first list of Controls that JsonForms would treat as visible. */
export function collectVisibleControlsInSubtree(
  root: UISchemaElement,
  rootData: unknown,
  dispatchPath: string,
  ajv: Ajv,
  config: unknown,
): UISchemaElement[] {
  const controls: UISchemaElement[] = [];

  function walk(el: UISchemaElement, path: string) {
    if (!jsonFormsIsVisible(el, rootData, path, ajv, config)) {
      return;
    }
    if (isControl(el)) {
      controls.push(el);
      return;
    }
    const els = (el as { elements?: UISchemaElement[] }).elements;
    if (!Array.isArray(els)) {
      return;
    }
    const childPath = dispatchPathForLayoutChild(path);
    for (const c of els) {
      walk(c, childPath);
    }
  }

  walk(root, dispatchPath);
  return controls;
}
