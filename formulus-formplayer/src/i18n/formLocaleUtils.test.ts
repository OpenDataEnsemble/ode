import { describe, expect, it } from 'vitest';
import {
  resolveEffectiveFormLocale,
  stampFormLocaleOnObservationData,
} from './formLocaleUtils';

describe('formLocaleUtils', () => {
  it('resolves default when formLocale missing', () => {
    expect(resolveEffectiveFormLocale({ locale: 'en' })).toBe('default');
  });

  it('passes through BCP-47 tags', () => {
    expect(resolveEffectiveFormLocale({ formLocale: 'fj' })).toBe('fj');
  });

  it('stamps formLocale on observation data', () => {
    expect(stampFormLocaleOnObservationData({ name: 'Ada' }, 'fj')).toEqual({
      name: 'Ada',
      formLocale: 'fj',
    });
  });
});
