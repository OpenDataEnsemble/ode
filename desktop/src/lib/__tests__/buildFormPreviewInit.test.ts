import { describe, expect, it } from 'vitest';
import {
  buildFormPreviewInit,
  inferObservationIdFromSavedData,
  parseJsonObject,
} from '../buildFormPreviewInit';

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

  it('sets subObservationMode when requested', () => {
    const init = buildFormPreviewInit({
      formType: 'Child',
      params: {},
      savedData: {},
      formSchema: {},
      uiSchema: {},
      subObservationMode: true,
    });
    expect(init.subObservationMode).toBe(true);
  });

  it('forwards linkedFormSpecs when provided', () => {
    const linked = {
      child: { schema: { type: 'object' }, uiSchema: {} },
    };
    const init = buildFormPreviewInit({
      formType: 'Parent',
      params: {},
      savedData: {},
      formSchema: {},
      uiSchema: {},
      linkedFormSpecs: linked,
    });
    expect(init.linkedFormSpecs).toEqual(linked);
  });
});

describe('inferObservationIdFromSavedData', () => {
  it('reads observationId then id', () => {
    expect(inferObservationIdFromSavedData({ observationId: '  abc  ' })).toBe(
      'abc',
    );
    expect(inferObservationIdFromSavedData({ id: 'x' })).toBe('x');
    expect(inferObservationIdFromSavedData({})).toBeNull();
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
