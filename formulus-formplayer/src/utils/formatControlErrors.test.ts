import { describe, expect, it } from 'vitest';
import { formatControlErrors } from './formatControlErrors';

describe('formatControlErrors', () => {
  it('returns null for empty input', () => {
    expect(formatControlErrors(null)).toBeNull();
    expect(formatControlErrors(undefined)).toBeNull();
    expect(formatControlErrors('')).toBeNull();
    expect(formatControlErrors([])).toBeNull();
  });

  it('joins string arrays', () => {
    expect(formatControlErrors(['Required', 'Too short'])).toBe(
      'Required, Too short',
    );
  });

  it('stringifies scalar errors', () => {
    expect(formatControlErrors('must have required property')).toBe(
      'must have required property',
    );
  });
});
