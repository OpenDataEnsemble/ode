import { useCallback, useEffect, useRef } from 'react';

function isTextInput(
  el: EventTarget | null,
): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) {
    const type = el.type?.toLowerCase() ?? 'text';
    return ![
      'hidden',
      'checkbox',
      'radio',
      'file',
      'button',
      'submit',
      'reset',
    ].includes(type);
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
 * Clamps FormLayout scroll when the IME opens and after text field focus.
 * Avoids scrolling into flex filler / padding void above the nav bar.
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
      if (!isTextInput(target)) return;

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

    vv?.addEventListener('resize', onViewportChange);
    vv?.addEventListener('scroll', onViewportChange);
    el.addEventListener('focusin', onFocusIn);

    return () => {
      vv?.removeEventListener('resize', onViewportChange);
      vv?.removeEventListener('scroll', onViewportChange);
      el.removeEventListener('focusin', onFocusIn);
    };
  }, [clamp]);

  return scrollRef;
}
