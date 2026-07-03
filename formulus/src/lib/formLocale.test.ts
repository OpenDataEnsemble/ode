import { describe, expect, it } from 'vitest';
import {
  FORM_LOCALE_DEFAULT,
  isStaleFormLocalePreference,
  resolveActiveFormLocale,
} from './formLocale';

describe('formLocale', () => {
  it('prefers session override over saved and settings', () => {
    expect(
      resolveActiveFormLocale({
        preference: 'pt',
        availableLocales: ['pt'],
        sessionOverride: 'fj',
        savedFormLocale: 'fr',
      }),
    ).toBe('fj');
  });

  it('uses saved form locale on edit when no session override', () => {
    expect(
      resolveActiveFormLocale({
        preference: FORM_LOCALE_DEFAULT,
        availableLocales: [],
        savedFormLocale: 'fj',
      }),
    ).toBe('fj');
  });

  it('falls back to default when settings preference is stale', () => {
    expect(
      resolveActiveFormLocale({
        preference: 'fj',
        availableLocales: ['pt'],
      }),
    ).toBe(FORM_LOCALE_DEFAULT);
  });

  it('keeps settings preference when still in union', () => {
    expect(
      resolveActiveFormLocale({
        preference: 'pt-BR',
        availableLocales: ['pt-br'],
      }),
    ).toBe('pt-BR');
  });

  it('detects stale settings preference', () => {
    expect(isStaleFormLocalePreference('fj', ['pt'])).toBe(true);
    expect(isStaleFormLocalePreference(FORM_LOCALE_DEFAULT, [])).toBe(false);
  });
});
