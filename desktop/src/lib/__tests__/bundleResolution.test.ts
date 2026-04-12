import { describe, expect, it } from 'vitest';
import {
  mergeExtensionsFromLayers,
  normalizeExtJson,
} from '../bundleResolution';

describe('mergeExtensionsFromLayers', () => {
  it('lets form-level override app-level keys', () => {
    const app = normalizeExtJson({
      definitions: { A: { type: 'string' } },
      functions: {
        foo: { path: 'a.js', export: 'foo' },
      },
    });
    const form = normalizeExtJson({
      definitions: { A: { type: 'number' } },
      functions: {
        foo: { path: 'b.js', export: 'foo' },
      },
    });
    const merged = mergeExtensionsFromLayers(app, form);
    expect(merged.definitions.A).toEqual({ type: 'number' });
    expect(merged.functions.foo?.module).toBe('b.js');
  });
});
