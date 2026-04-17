import { describe, expect, it } from 'vitest';
import { buildFormPreviewInit, parseJsonObject } from '../buildFormPreviewInit';

describe('buildFormPreviewInit', () => {
  it('builds new-observation init', () => {
    const init = buildFormPreviewInit({
      formType: 'MyForm',
      params: { defaultData: { a: 1 } },
      savedData: {},
      formSchema: { type: 'object' },
      uiSchema: { type: 'VerticalLayout' },
    });
    expect(init.formType).toBe('MyForm');
    expect(init.observationId).toBeNull();
  });

  it('passes observationId for edit mode', () => {
    const init = buildFormPreviewInit({
      formType: 'MyForm',
      params: {},
      savedData: { x: 1 },
      formSchema: {},
      uiSchema: {},
      observationId: 'obs-123',
    });
    expect(init.observationId).toBe('obs-123');
    expect(init.savedData).toEqual({ x: 1 });
  });
});

describe('parseJsonObject', () => {
  it('accepts empty string as {}', () => {
    const r = parseJsonObject('', 'x');
    expect(r.ok && r.value).toEqual({});
  });

  it('rejects arrays', () => {
    const r = parseJsonObject('[1]', 'x');
    expect(r.ok).toBe(false);
  });
});
