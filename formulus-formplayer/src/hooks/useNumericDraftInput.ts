import { useCallback, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import type { KeyboardPrimaryEnterKeyHint } from '../utils/keyboardEnterKeyHint';

export type NumericSchemaKind = 'integer' | 'number';

export type ParseNumericResult =
  | { kind: 'empty' }
  | { kind: 'complete'; value: number }
  | { kind: 'incomplete' };

/** Format committed observation data for display when the field is not focused. */
export function formatNumericDisplay(data: unknown): string {
  if (data === undefined || data === null || data === '') return '';
  if (typeof data === 'number' && !Number.isNaN(data)) return String(data);
  return '';
}

/**
 * Parse draft text from a numeric input.
 * Never clamps to schema bounds — callers validate via AJV.
 */
export function parseNumericDraft(
  text: string,
  schemaKind: NumericSchemaKind,
): ParseNumericResult {
  const trimmed = text.trim();
  if (trimmed === '') return { kind: 'empty' };

  if (schemaKind === 'integer') {
    if (trimmed === '-') return { kind: 'incomplete' };
    if (/^-?\d+$/.test(trimmed)) {
      return { kind: 'complete', value: parseInt(trimmed, 10) };
    }
    if (/^-?\d*\.$/.test(trimmed) || trimmed === '.') {
      return { kind: 'incomplete' };
    }
    // Non-integer decimal text (e.g. "1.5") — commit as float so AJV type:integer fails.
    const asFloat = parseFloat(trimmed);
    if (!Number.isNaN(asFloat) && /^-?(\d+\.\d+|\.\d+)$/.test(trimmed)) {
      return { kind: 'complete', value: asFloat };
    }
    return { kind: 'incomplete' };
  }

  if (trimmed === '-' || trimmed === '.' || trimmed === '-.') {
    return { kind: 'incomplete' };
  }
  if (/^-?\d+\.$/.test(trimmed)) {
    return { kind: 'incomplete' };
  }
  if (/^-?(\d+\.?\d*|\.\d+)$/.test(trimmed)) {
    const value = parseFloat(trimmed);
    if (!Number.isNaN(value)) {
      return { kind: 'complete', value };
    }
  }
  return { kind: 'incomplete' };
}

export type UseNumericDraftInputOptions = {
  data: unknown;
  path: string;
  handleChange: (path: string, value: unknown) => void;
  schemaKind: NumericSchemaKind;
  enterKeyHint?: KeyboardPrimaryEnterKeyHint;
  enabled?: boolean;
};

export type UseNumericDraftInputResult = {
  isFocused: boolean;
  displayValue: string;
  inputMode: 'numeric' | 'decimal';
  onFocus: () => void;
  onBlur: () => void;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Sync draft text after a programmatic value change (e.g. stepper +/-). */
  syncDraftFromData: (value: unknown) => void;
  inputProps: Pick<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'inputMode' | 'enterKeyHint' | 'autoComplete'
  >;
};

export function useNumericDraftInput({
  data,
  path,
  handleChange,
  schemaKind,
  enterKeyHint,
  enabled = true,
}: UseNumericDraftInputOptions): UseNumericDraftInputResult {
  const [isFocused, setIsFocused] = useState(false);
  const [draftText, setDraftText] = useState<string | null>(null);

  const commitParsed = useCallback(
    (text: string) => {
      const parsed = parseNumericDraft(text, schemaKind);
      if (parsed.kind === 'empty') {
        handleChange(path, undefined);
      } else if (parsed.kind === 'complete') {
        handleChange(path, parsed.value);
      }
    },
    [handleChange, path, schemaKind],
  );

  const displayValue =
    isFocused && draftText !== null ? draftText : formatNumericDisplay(data);

  const onFocus = useCallback(() => {
    if (!enabled) return;
    setIsFocused(true);
    setDraftText(formatNumericDisplay(data));
  }, [data, enabled]);

  const onBlur = useCallback(() => {
    if (draftText !== null) {
      commitParsed(draftText);
    }
    setIsFocused(false);
    setDraftText(null);
  }, [commitParsed, draftText]);

  const onChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const text = event.target.value;
      setDraftText(text);
      commitParsed(text);
    },
    [commitParsed],
  );

  const syncDraftFromData = useCallback(
    (value: unknown) => {
      const formatted = formatNumericDisplay(value);
      if (isFocused) {
        setDraftText(formatted);
      }
    },
    [isFocused],
  );

  return {
    isFocused,
    displayValue,
    inputMode: schemaKind === 'integer' ? 'numeric' : 'decimal',
    onFocus,
    onBlur,
    onChange,
    syncDraftFromData,
    inputProps: {
      type: 'text',
      inputMode: schemaKind === 'integer' ? 'numeric' : 'decimal',
      ...(enterKeyHint ? { enterKeyHint } : {}),
      autoComplete: 'off',
    },
  };
}
