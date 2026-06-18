import { useCallback, useEffect, useRef } from 'react';

/** Input types that should trigger scroll clamp on value change. */
export function isClampableInputType(type: string | undefined): boolean {
  const normalized = type?.toLowerCase() ?? 'text';
  return ![
    'hidden',
    'checkbox',
    'radio',
    'file',
    'button',
    'submit',
    'reset',
  ].includes(normalized);
}

/** Inputs that participate in IME scroll clamping (focus + value change). */
export function isFormFieldForScrollClamp(
  el: EventTarget | null,
): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    return true;
  }
  if (el instanceof HTMLInputElement) {
    return isClampableInputType(el.type);
  }
  return false;
}

/** Prevent scrolling past the last real content row inside the form scroll area. */
export function clampScrollTop(el: HTMLElement): void {
  const max = Math.max(0, el.scrollHeight - el.clientHeight);
  if (el.scrollTop > max) {
    el.scrollTop = max;
  }
}

/**
 * Clamps FormLayout scroll when the IME opens, on field focus, and after value
 * changes (number stepper +/-, numeric keyboard input, layout reflow).
 */
export function useKeyboardScrollClamp<T extends HTMLElement>() {
  const scrollRef = useRef<T | null>(null);

  const clamp = useCallback(() => {
    const el = scrollRef.current;
    if (el) clampScrollTop(el);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const vv = window.visualViewport;

    const onViewportChange = () => {
      requestAnimationFrame(clamp);
    };

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!isFormFieldForScrollClamp(target)) return;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (target instanceof HTMLElement) {
            try {
              target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
            } catch {
              target.scrollIntoView({ block: 'nearest' });
            }
          }
          clamp();
        });
      });
    };

    const onInputOrChange = (event: Event) => {
      if (!isFormFieldForScrollClamp(event.target)) return;
      requestAnimationFrame(clamp);
    };

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            const active = document.activeElement;
            if (
              active &&
              el.contains(active) &&
              isFormFieldForScrollClamp(active)
            ) {
              requestAnimationFrame(clamp);
            }
          })
        : null;

    resizeObserver?.observe(el);

    vv?.addEventListener('resize', onViewportChange);
    vv?.addEventListener('scroll', onViewportChange);
    el.addEventListener('focusin', onFocusIn);
    el.addEventListener('input', onInputOrChange, true);
    el.addEventListener('change', onInputOrChange, true);

    return () => {
      resizeObserver?.disconnect();
      vv?.removeEventListener('resize', onViewportChange);
      vv?.removeEventListener('scroll', onViewportChange);
      el.removeEventListener('focusin', onFocusIn);
      el.removeEventListener('input', onInputOrChange, true);
      el.removeEventListener('change', onInputOrChange, true);
    };
  }, [clamp]);

  return scrollRef;
}
