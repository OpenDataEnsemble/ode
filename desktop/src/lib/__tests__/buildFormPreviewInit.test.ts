import { describe, expect, it, beforeEach } from 'vitest';
import {
  buildFormPreviewInit,
  formatPreviewParamsJson,
  inferObservationIdFromSavedData,
  mergePreviewParams,
  parseJsonObject,
  previewParamsFromLocalePrefs,
} from '../buildFormPreviewInit';
import {
  getDesktopLocalePreference,
  setDesktopLocalePreference,
} from '../uiLocale';

describe('buildFormPreviewInit', () => {
  beforeEach(() => {
    setDesktopLocalePreference('auto');
  });

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

  it('resolves UI locale from params.locale override', () => {
    setDesktopLocalePreference('en');
    const init = buildFormPreviewInit({
      formType: 'MyForm',
      params: { locale: 'pt' },
      savedData: {},
      formSchema: { type: 'object' },
      uiSchema: { type: 'VerticalLayout' },
    });
    expect(init.params?.locale).toBe('pt');
  });

  it('resolves UI locale from desktop preference when params omit locale', () => {
    setDesktopLocalePreference('fr');
    const init = buildFormPreviewInit({
      formType: 'MyForm',
      params: {},
      savedData: {},
      formSchema: { type: 'object' },
      uiSchema: { type: 'VerticalLayout' },
    });
    expect(init.params?.locale).toBe('fr');
    expect(getDesktopLocalePreference()).toBe('fr');
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

describe('mergePreviewParams', () => {
  it('merges overrides and removes keys set to undefined', () => {
    expect(
      mergePreviewParams(
        { locale: 'en', defaultData: { a: 1 } },
        {
          locale: 'pt',
        },
      ),
    ).toEqual({ locale: 'pt', defaultData: { a: 1 } });

    expect(
      mergePreviewParams(
        { locale: 'en', defaultData: { a: 1 } },
        {
          locale: undefined,
        },
      ),
    ).toEqual({ defaultData: { a: 1 } });
  });
});

describe('previewParamsFromLocalePrefs', () => {
  it('includes explicit locale prefs only', () => {
    expect(
      previewParamsFromLocalePrefs({
        uiLocalePreference: 'pt',
        formLocalePreference: 'sv',
      }),
    ).toEqual({ locale: 'pt', formLocale: 'sv' });

    expect(
      previewParamsFromLocalePrefs({
        uiLocalePreference: 'auto',
        formLocalePreference: 'default',
      }),
    ).toEqual({});
  });
});

describe('formatPreviewParamsJson', () => {
  it('returns {} for empty params', () => {
    expect(formatPreviewParamsJson({})).toBe('{}');
  });
});
