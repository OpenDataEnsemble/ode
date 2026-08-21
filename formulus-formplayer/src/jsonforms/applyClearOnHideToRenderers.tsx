import React, { useCallback } from 'react';
import {
  Actions,
  Resolve,
  Runtime,
  composeWithUi,
  getAjv,
  type JsonFormsRendererRegistryEntry,
  type UISchemaElement,
} from '@jsonforms/core';
import { useJsonForms } from '@jsonforms/react';
import { useClearOnHide, type ClearOnHideHandleChange } from './useClearOnHide';

type RegistryRendererProps = {
  visible?: boolean;
  path?: string;
  data?: unknown;
  handleChange?: ClearOnHideHandleChange;
  uischema?: UISchemaElement & { type?: string; scope?: string };
};

/**
 * Registry HOC: clear Control values on SHOW/HIDE hide.
 *
 * JsonForms does **not** pass `visible` or the composed control `path` into
 * registry renderers — those are injected later by `withJsonFormsControlProps`.
 * We therefore:
 * - compose the data path via {@link composeWithUi}
 * - evaluate visibility via {@link Runtime.isVisible}
 *
 * Layouts and Labels are skipped (`uischema.type !== 'Control'`).
 */
export function withRegistryClearOnHide<P extends RegistryRendererProps>(
  Component: React.ComponentType<P>,
): React.FC<P> {
  const Wrapped: React.FC<P> = props => {
    const isControl = props.uischema?.type === 'Control';
    const ctx = useJsonForms();
    const rootData = ctx.core?.data;
    const dispatch = ctx.dispatch;
    const ajv = getAjv({ jsonforms: { ...ctx } } as never);

    const parentPath = typeof props.path === 'string' ? props.path : '';
    const path =
      isControl && props.uischema
        ? composeWithUi(props.uischema, parentPath)
        : undefined;

    // Prefer an explicit `visible` when present (inner ControlProps / tests);
    // otherwise mirror JsonForms rule evaluation for registry-level wraps.
    const visible =
      props.visible !== undefined
        ? props.visible
        : isControl && props.uischema && ajv
          ? Runtime.isVisible(props.uischema, rootData, ajv, ctx.config)
          : true;

    const dataFromStore =
      isControl && path && rootData != null
        ? Resolve.data(rootData, path)
        : undefined;
    // Only trust props.data when ControlProps were injected (has handleChange).
    // Registry dispatch never passes data — undefined means "use store".
    const data =
      props.handleChange !== undefined && props.data !== undefined
        ? props.data
        : dataFromStore;

    const injectedHandleChange = props.handleChange;
    const handleChange = useCallback<ClearOnHideHandleChange>(
      (p, value) => {
        if (typeof injectedHandleChange === 'function') {
          injectedHandleChange(p, value);
          return;
        }
        dispatch?.(Actions.update(p, () => value));
      },
      [injectedHandleChange, dispatch],
    );

    useClearOnHide({
      visible: isControl ? visible : true,
      path: isControl ? path : undefined,
      data: isControl ? data : undefined,
      handleChange: isControl ? handleChange : undefined,
    });

    return <Component {...props} />;
  };
  Wrapped.displayName = `WithRegistryClearOnHide(${
    Component.displayName || Component.name || 'Component'
  })`;
  return Wrapped;
}

/** Apply clear-on-hide to every renderer registry entry (Formplayer default). */
export function applyClearOnHideToRenderers(
  renderers: JsonFormsRendererRegistryEntry[],
): JsonFormsRendererRegistryEntry[] {
  return renderers.map(entry => ({
    ...entry,
    renderer: withRegistryClearOnHide(
      entry.renderer as React.ComponentType<RegistryRendererProps>,
    ),
  }));
}
