import React from 'react';
import { useClearOnHide, type ClearOnHideHandleChange } from './useClearOnHide';
import {
  applyClearOnHideToRenderers,
  withRegistryClearOnHide,
} from './applyClearOnHideToRenderers';

/** JsonForms passes `visible: false` when SHOW/HIDE rules hide a control. */
export function isControlHidden(visible?: boolean): boolean {
  return visible === false;
}

type VisibleGuardProps = {
  visible?: boolean;
  path?: string;
  data?: unknown;
  handleChange?: ClearOnHideHandleChange;
};

/**
 * HOC: clear the control value when hidden, then return null (SHOW/HIDE rules).
 * Clearing requires JsonForms ControlProps (`path`, `data`, `handleChange`);
 * without them it only hides (same as before).
 *
 * Prefer {@link applyClearOnHideToRenderers} for the Formplayer registry so
 * stock Material controls are covered too; this HOC remains for local wrappers.
 */
export function withVisibleGuard<P extends VisibleGuardProps>(
  Component: React.ComponentType<P>,
): React.FC<P> {
  const Guarded = (props: P) => {
    useClearOnHide({
      visible: props.visible,
      path: props.path,
      data: props.data,
      handleChange: props.handleChange,
    });
    if (isControlHidden(props.visible)) return null;
    return <Component {...props} />;
  };
  Guarded.displayName = `WithVisibleGuard(${
    Component.displayName || Component.name || 'Component'
  })`;
  return Guarded;
}

export { useClearOnHide, hasClearableValue } from './useClearOnHide';
export { applyClearOnHideToRenderers, withRegistryClearOnHide };
