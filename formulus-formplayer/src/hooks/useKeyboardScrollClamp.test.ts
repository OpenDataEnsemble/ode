import { describe, expect, it } from 'vitest';
import { clampScrollTop } from './useKeyboardScrollClamp';

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
