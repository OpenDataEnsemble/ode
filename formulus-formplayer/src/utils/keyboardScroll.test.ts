// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  clampScrollTop,
  computeScrollDeltaForField,
  isFieldObscuredInContainer,
  revealFieldIfNeeded,
} from './keyboardScroll';

describe('isFieldObscuredInContainer', () => {
  it('returns false when field is fully inside visible band', () => {
    const container = { top: 0, bottom: 400 };
    const field = { top: 100, bottom: 150 };
    expect(isFieldObscuredInContainer(container, field)).toBe(false);
  });

  it('returns true when field bottom is below visible area', () => {
    const container = { top: 0, bottom: 200 };
    const field = { top: 150, bottom: 250 };
    expect(isFieldObscuredInContainer(container, field)).toBe(true);
  });

  it('returns true when field top is above visible area', () => {
    const container = { top: 100, bottom: 400 };
    const field = { top: 50, bottom: 120 };
    expect(isFieldObscuredInContainer(container, field)).toBe(true);
  });
});

describe('computeScrollDeltaForField', () => {
  it('returns positive delta when field extends below container', () => {
    const container = { top: 0, bottom: 200 };
    const field = { top: 150, bottom: 230 };
    expect(computeScrollDeltaForField(container, field, 8, 16)).toBe(46);
  });

  it('returns negative delta when field extends above container', () => {
    const container = { top: 100, bottom: 400 };
    const field = { top: 90, bottom: 150 };
    expect(computeScrollDeltaForField(container, field, 8, 16)).toBe(-18);
  });

  it('returns zero when field is visible', () => {
    const container = { top: 0, bottom: 300 };
    const field = { top: 50, bottom: 100 };
    expect(computeScrollDeltaForField(container, field)).toBe(0);
  });
});

describe('revealFieldIfNeeded', () => {
  it('does not scroll when field is already visible', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'scrollTop', { value: 0, writable: true });
    Object.defineProperty(container, 'scrollHeight', { value: 500 });
    Object.defineProperty(container, 'clientHeight', { value: 300 });
    container.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 300,
        left: 0,
        right: 100,
        width: 100,
        height: 300,
      }) as DOMRect;

    const field = document.createElement('input');
    container.appendChild(field);
    field.getBoundingClientRect = () =>
      ({
        top: 50,
        bottom: 80,
        left: 0,
        right: 100,
        width: 100,
        height: 30,
      }) as DOMRect;

    const changed = revealFieldIfNeeded(container, field);
    expect(changed).toBe(false);
    expect(container.scrollTop).toBe(0);
  });

  it('scrolls down when field bottom is below container', () => {
    const container = document.createElement('div');
    let scrollTop = 0;
    Object.defineProperty(container, 'scrollTop', {
      get: () => scrollTop,
      set: (v: number) => {
        scrollTop = v;
      },
    });
    Object.defineProperty(container, 'scrollHeight', { value: 800 });
    Object.defineProperty(container, 'clientHeight', { value: 300 });
    container.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 300,
        left: 0,
        right: 100,
        width: 100,
        height: 300,
      }) as DOMRect;

    const field = document.createElement('input');
    container.appendChild(field);
    field.getBoundingClientRect = () =>
      ({
        top: 250,
        bottom: 320,
        left: 0,
        right: 100,
        width: 100,
        height: 70,
      }) as DOMRect;

    const changed = revealFieldIfNeeded(container, field, {
      marginBottom: 16,
      marginTop: 8,
    });
    expect(changed).toBe(true);
    expect(scrollTop).toBeGreaterThan(0);
    clampScrollTop(container);
    expect(scrollTop).toBeLessThanOrEqual(500);
  });
});
