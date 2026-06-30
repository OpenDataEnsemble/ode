import { useCallback, useEffect, useRef } from 'react';
import {
  clampScrollTop,
  isFieldObscuredInContainer,
  revealFieldIfNeeded,
} from '../utils/keyboardScroll';

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
 * during the initial keyboard-open window — never on value change or caret moves.
 */
export function useKeyboardScrollClamp<T extends HTMLElement>() {
  const scrollRef = useRef<T | null>(null);
  const focusedFieldRef = useRef<HTMLElement | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** True from focus until the IME settle window ends; blocks re-reveal while typing. */
  const keyboardRevealSessionRef = useRef(false);

  const clamp = useCallback(() => {
    const el = scrollRef.current;
    if (el) clampScrollTop(el);
  }, []);

  const endKeyboardRevealSession = useCallback(() => {
    keyboardRevealSessionRef.current = false;
  }, []);

  const tryRevealFocused = useCallback(() => {
    const container = scrollRef.current;
    const field = focusedFieldRef.current;
    if (!container || !field || !container.contains(field)) return;

    revealFieldIfNeeded(container, field, { marginBottom: 24, marginTop: 8 });
    clamp();

    const containerRect = container.getBoundingClientRect();
    const fieldRect = field.getBoundingClientRect();
    if (
      !isFieldObscuredInContainer(containerRect, fieldRect, 8, 24)
    ) {
      endKeyboardRevealSession();
    }
  }, [clamp, endKeyboardRevealSession]);

  const scheduleReveal = useCallback(() => {
    if (!keyboardRevealSessionRef.current) return;

    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        tryRevealFocused();
        revealTimerRef.current = setTimeout(() => {
          tryRevealFocused();
          endKeyboardRevealSession();
          revealTimerRef.current = null;
        }, KEYBOARD_REVEAL_DELAY_MS);
      });
    });
  }, [endKeyboardRevealSession, tryRevealFocused]);

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

    const onViewportResize = () => {
      if (focusedFieldRef.current && keyboardRevealSessionRef.current) {
        scheduleReveal();
      } else {
        runClampChain();
      }
    };

    // Caret moves while typing fire visualViewport scroll on Android WebView — clamp only.
    const onViewportScroll = () => {
      runClampChain();
    };

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!isFormFieldForScrollClamp(target)) return;
      if (!(target instanceof HTMLElement)) return;

      focusedFieldRef.current = target;
      keyboardRevealSessionRef.current = true;
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
      endKeyboardRevealSession();
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
      runClampChain();
    };

    // Clamp only on content resize (e.g. value change re-render). Re-revealing here
    // caused a scroll gap above the keyboard on first keystroke in number fields.
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            runClampChain();
          })
        : null;

    resizeObserver?.observe(el);

    vv?.addEventListener('resize', onViewportResize);
    vv?.addEventListener('scroll', onViewportScroll);
    el.addEventListener('focusin', onFocusIn);
    el.addEventListener('focusout', onFocusOut);

    return () => {
      resizeObserver?.disconnect();
      vv?.removeEventListener('resize', onViewportResize);
      vv?.removeEventListener('scroll', onViewportScroll);
      el.removeEventListener('focusin', onFocusIn);
      el.removeEventListener('focusout', onFocusOut);
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
      }
    };
  }, [
    clamp,
    endKeyboardRevealSession,
    runClampChain,
    scheduleReveal,
    tryRevealFocused,
  ]);

  return scrollRef;
}
