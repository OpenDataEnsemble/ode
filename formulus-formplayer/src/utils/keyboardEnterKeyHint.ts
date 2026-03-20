import type { InputHTMLAttributes } from 'react';

export type KeyboardPrimaryEnterKeyHint = NonNullable<
  InputHTMLAttributes<HTMLInputElement>['enterKeyHint']
>;

const VALID_HINTS = new Set<KeyboardPrimaryEnterKeyHint>([
  'enter',
  'done',
  'go',
  'next',
  'previous',
  'search',
  'send',
]);

/**
 * Map author/localized primary action labels to a valid `enterKeyHint`.
 * The platform keyboard only supports a fixed set (not arbitrary strings).
 */
export function enterKeyHintFromPrimaryButtonLabel(
  label: string | undefined,
): KeyboardPrimaryEnterKeyHint | undefined {
  if (label == null || String(label).trim() === '') return undefined;
  const t = String(label).trim().toLowerCase();

  if (VALID_HINTS.has(t as KeyboardPrimaryEnterKeyHint)) {
    return t as KeyboardPrimaryEnterKeyHint;
  }

  if (/\b(next|forward)\b/.test(t) || t === '›' || t === '→') return 'next';
  if (
    /\b(finalize|submit|complete|finish|save)\b/.test(t) ||
    t.includes('finalize')
  ) {
    return 'done';
  }
  if (/\b(continu|proceed)\b/.test(t)) return 'go';
  if (t.includes('search')) return 'search';
  if (t.includes('send')) return 'send';
  if (/\b(back|prev)\b/.test(t)) return 'previous';

  return undefined;
}

export function primaryKeyboardEnterKeyHint(
  isFinalizePage: boolean,
  nextButtonLabel: string | undefined,
  finalizeButtonLabel = 'Finalize',
): KeyboardPrimaryEnterKeyHint {
  if (isFinalizePage) {
    return enterKeyHintFromPrimaryButtonLabel(finalizeButtonLabel) ?? 'done';
  }
  return enterKeyHintFromPrimaryButtonLabel(nextButtonLabel) ?? 'next';
}
