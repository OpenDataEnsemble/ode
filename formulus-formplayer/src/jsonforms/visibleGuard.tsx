import React from 'react';

/** JsonForms passes `visible: false` when SHOW/HIDE rules hide a control. */
export function isControlHidden(visible?: boolean): boolean {
  return visible === false;
}

/**
 * HOC: return null when JsonForms marks the control hidden (SHOW/HIDE rules).
 */
export function withVisibleGuard<P extends { visible?: boolean }>(
  Component: React.ComponentType<P>,
): React.FC<P> {
  const Guarded = (props: P) => {
    if (isControlHidden(props.visible)) return null;
    return <Component {...props} />;
  };
  Guarded.displayName = `WithVisibleGuard(${
    Component.displayName || Component.name || 'Component'
  })`;
  return Guarded;
}
