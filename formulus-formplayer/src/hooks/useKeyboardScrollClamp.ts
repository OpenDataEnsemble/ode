import { useCallback, useEffect, useRef } from 'react';
import { clampScrollTop, revealFieldIfNeeded } from '../utils/keyboardScroll';

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

export { clampScrollTop } from '../utils/keyboardScroll';

const KEYBOARD_REVEAL_DELAY_MS = 100;

/**
 * Clamps FormLayout scroll when the IME opens and reveals focused fields only
 * when obscured after keyboard animation — never scrollIntoView on value change.
 */
export function useKeyboardScrollClamp<T extends HTMLElement>() {
  const scrollRef = useRef<T | null>(null);
  const focusedFieldRef = useRef<HTMLElement | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clamp = useCallback(() => {
    const el = scrollRef.current;
    if (el) clampScrollTop(el);
  }, []);

  const tryRevealFocused = useCallback(() => {
    const container = scrollRef.current;
    const field = focusedFieldRef.current;
    if (!container || !field || !container.contains(field)) return;
    revealFieldIfNeeded(container, field, { marginBottom: 24, marginTop: 8 });
    clamp();
  }, [clamp]);

  const scheduleReveal = useCallback(() => {
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        tryRevealFocused();
        revealTimerRef.current = setTimeout(() => {
          tryRevealFocused();
          revealTimerRef.current = null;
        }, KEYBOARD_REVEAL_DELAY_MS);
      });
    });
  }, [tryRevealFocused]);

  const runClampChain = useCallback(() => {
    requestAnimationFrame(() => {
      clamp();
      requestAnimationFrame(clamp);
    });
  }, [clamp]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const vv = window.visualViewport;

    const onViewportChange = () => {
      if (focusedFieldRef.current) {
        scheduleReveal();
      } else {
        requestAnimationFrame(clamp);
      }
    };

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!isFormFieldForScrollClamp(target)) return;
      if (!(target instanceof HTMLElement)) return;

      focusedFieldRef.current = target;
      scheduleReveal();
    };

    const onFocusOut = (event: FocusEvent) => {
      const target = event.target;
      if (!isFormFieldForScrollClamp(target)) return;

      const related = event.relatedTarget;
      if (
        related instanceof HTMLElement &&
        isFormFieldForScrollClamp(related) &&
        el.contains(related)
      ) {
        return;
      }

      if (focusedFieldRef.current === target) {
        focusedFieldRef.current = null;
      }
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
      runClampChain();
    };

    const onInputOrChange = (event: Event) => {
      if (!isFormFieldForScrollClamp(event.target)) return;
      runClampChain();
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
              focusedFieldRef.current = active;
              tryRevealFocused();
            } else {
              runClampChain();
            }
          })
        : null;

    resizeObserver?.observe(el);

    vv?.addEventListener('resize', onViewportChange);
    vv?.addEventListener('scroll', onViewportChange);
    el.addEventListener('focusin', onFocusIn);
    el.addEventListener('focusout', onFocusOut);
    el.addEventListener('input', onInputOrChange, true);
    el.addEventListener('change', onInputOrChange, true);

    return () => {
      resizeObserver?.disconnect();
      vv?.removeEventListener('resize', onViewportChange);
      vv?.removeEventListener('scroll', onViewportChange);
      el.removeEventListener('focusin', onFocusIn);
      el.removeEventListener('focusout', onFocusOut);
      el.removeEventListener('input', onInputOrChange, true);
      el.removeEventListener('change', onInputOrChange, true);
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
      }
    };
  }, [clamp, runClampChain, scheduleReveal, tryRevealFocused]);

  return scrollRef;
}
