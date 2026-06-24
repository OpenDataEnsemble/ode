import { describe, expect, it } from 'vitest';
import {
  formatNumericDisplay,
  parseNumericDraft,
} from './useNumericDraftInput';

describe('formatNumericDisplay', () => {
  it('formats numbers and empty values', () => {
    expect(formatNumericDisplay(16)).toBe('16');
    expect(formatNumericDisplay(12.5)).toBe('12.5');
    expect(formatNumericDisplay(undefined)).toBe('');
    expect(formatNumericDisplay(null)).toBe('');
    expect(formatNumericDisplay('')).toBe('');
  });
});

describe('parseNumericDraft', () => {
  describe('integer', () => {
    it('parses complete integers without clamping to bounds', () => {
      expect(parseNumericDraft('35', 'integer')).toEqual({
        kind: 'complete',
        value: 35,
      });
      expect(parseNumericDraft('0', 'integer')).toEqual({
        kind: 'complete',
        value: 0,
      });
      expect(parseNumericDraft('-3', 'integer')).toEqual({
        kind: 'complete',
        value: -3,
      });
    });

    it('returns empty for blank input', () => {
      expect(parseNumericDraft('', 'integer')).toEqual({ kind: 'empty' });
      expect(parseNumericDraft('   ', 'integer')).toEqual({ kind: 'empty' });
    });

    it('returns incomplete for partial integer entry', () => {
      expect(parseNumericDraft('-', 'integer')).toEqual({ kind: 'incomplete' });
      expect(parseNumericDraft('1.', 'integer')).toEqual({
        kind: 'incomplete',
      });
    });

    it('commits non-integer decimals as float for AJV to reject', () => {
      expect(parseNumericDraft('1.5', 'integer')).toEqual({
        kind: 'complete',
        value: 1.5,
      });
    });
  });

  describe('number', () => {
    it('parses decimals', () => {
      expect(parseNumericDraft('12.5', 'number')).toEqual({
        kind: 'complete',
        value: 12.5,
      });
      expect(parseNumericDraft('.5', 'number')).toEqual({
        kind: 'complete',
        value: 0.5,
      });
    });

    it('allows partial decimal entry', () => {
      expect(parseNumericDraft('1.', 'number')).toEqual({ kind: 'incomplete' });
      expect(parseNumericDraft('-', 'number')).toEqual({ kind: 'incomplete' });
    });

    it('parses integers as numbers', () => {
      expect(parseNumericDraft('35', 'number')).toEqual({
        kind: 'complete',
        value: 35,
      });
    });
  });
});
