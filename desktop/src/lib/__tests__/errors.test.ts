import { describe, expect, it } from 'vitest';
import { messageFromUnknown } from '../errors';

describe('messageFromUnknown', () => {
  it('reads Error.message', () => {
    expect(messageFromUnknown(new Error('boom'), 'fallback')).toBe('boom');
  });

  it('reads plain string rejections from Tauri', () => {
    expect(messageFromUnknown('Too many files', 'fallback')).toBe(
      'Too many files',
    );
  });

  it('uses fallback for empty values', () => {
    expect(messageFromUnknown('', 'fallback')).toBe('fallback');
    expect(messageFromUnknown(null, 'fallback')).toBe('fallback');
  });
});
