import { describe, it, expect } from 'vitest';
import {
  parseChoiceLayout,
  choiceListSx,
  toggleButtonListSx,
  toggleButtonOrientation,
} from './choiceLayout';

describe('parseChoiceLayout', () => {
  it('defaults to vertical when options are missing', () => {
    expect(parseChoiceLayout()).toEqual({ mode: 'vertical' });
    expect(parseChoiceLayout({})).toEqual({ mode: 'vertical' });
  });

  it('parses horizontal and flow', () => {
    expect(parseChoiceLayout({ orientation: 'horizontal' })).toEqual({
      mode: 'horizontal',
    });
    expect(parseChoiceLayout({ orientation: 'flow' })).toEqual({
      mode: 'flow',
    });
  });

  it('parses cols-2 through cols-5', () => {
    expect(parseChoiceLayout({ orientation: 'cols-2' })).toEqual({
      mode: 'columns',
      columns: 2,
    });
    expect(parseChoiceLayout({ orientation: 'cols-3' })).toEqual({
      mode: 'columns',
      columns: 3,
    });
    expect(parseChoiceLayout({ orientation: 'cols-4' })).toEqual({
      mode: 'columns',
      columns: 4,
    });
    expect(parseChoiceLayout({ orientation: 'cols-5' })).toEqual({
      mode: 'columns',
      columns: 5,
    });
  });

  it('falls back to vertical for unknown orientation values', () => {
    expect(parseChoiceLayout({ orientation: 'cols-1' })).toEqual({
      mode: 'vertical',
    });
    expect(parseChoiceLayout({ orientation: 'cols-6' })).toEqual({
      mode: 'vertical',
    });
    expect(parseChoiceLayout({ orientation: 'grid' })).toEqual({
      mode: 'vertical',
    });
  });
});

describe('choiceListSx', () => {
  it('uses flex row wrap for flow', () => {
    const sx = choiceListSx({ mode: 'flow' }) as Record<string, unknown>;
    expect(sx.display).toBe('flex');
    expect(sx.flexDirection).toBe('row');
    expect(sx.flexWrap).toBe('wrap');
  });

  it('uses CSS grid for column layouts', () => {
    const sx = choiceListSx({ mode: 'columns', columns: 3 }) as Record<
      string,
      unknown
    >;
    expect(sx.display).toBe('grid');
    expect(sx.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
    expect(sx.alignItems).toBe('start');
  });
});

describe('toggle button layout helpers', () => {
  it('maps column mode to horizontal orientation with wrap', () => {
    const layout = { mode: 'columns' as const, columns: 3 as const };
    expect(toggleButtonOrientation(layout)).toBe('horizontal');
    const sx = toggleButtonListSx(layout, false) as Record<string, unknown>;
    expect(sx.flexWrap).toBe('wrap');
  });
});
