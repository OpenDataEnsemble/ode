import { describe, expect, it } from 'vitest';
import { clampScrollTop, isClampableInputType } from './useKeyboardScrollClamp';

describe('clampScrollTop', () => {
  it('does not change scrollTop when within range', () => {
    const el = {
      scrollHeight: 500,
      clientHeight: 300,
      scrollTop: 100,
    } as HTMLElement;
    clampScrollTop(el);
    expect(el.scrollTop).toBe(100);
  });

  it('clamps scrollTop to max scrollable offset', () => {
    const el = {
      scrollHeight: 500,
      clientHeight: 300,
      scrollTop: 250,
    } as HTMLElement;
    clampScrollTop(el);
    expect(el.scrollTop).toBe(200);
  });

  it('handles non-scrollable content', () => {
    const el = {
      scrollHeight: 200,
      clientHeight: 300,
      scrollTop: 50,
    } as HTMLElement;
    clampScrollTop(el);
    expect(el.scrollTop).toBe(0);
  });
});

describe('isClampableInputType', () => {
  it('includes number and text types', () => {
    expect(isClampableInputType('number')).toBe(true);
    expect(isClampableInputType('text')).toBe(true);
    expect(isClampableInputType(undefined)).toBe(true);
  });

  it('excludes buttons and hidden inputs', () => {
    expect(isClampableInputType('hidden')).toBe(false);
    expect(isClampableInputType('button')).toBe(false);
    expect(isClampableInputType('checkbox')).toBe(false);
  });
});
