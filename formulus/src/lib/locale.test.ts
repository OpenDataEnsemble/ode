import { describe, expect, it } from 'vitest';
import {
  localeLookupCandidates,
  matchOdeCatalogLocale,
  normalizeLocaleTag,
  resolveActiveLocale,
} from './locale';

describe('locale', () => {
  it('normalizes locale tags', () => {
    expect(normalizeLocaleTag('pt_BR')).toBe('pt-br');
    expect(normalizeLocaleTag('  EN  ')).toBe('en');
  });

  it('builds lookup candidates', () => {
    expect(localeLookupCandidates('pt-BR')).toEqual(['pt-br', 'pt']);
    expect(localeLookupCandidates('en')).toEqual(['en']);
  });

  it('matches ODE catalog locales', () => {
    expect(matchOdeCatalogLocale('pt-BR')).toBe('pt');
    expect(matchOdeCatalogLocale('de')).toBeNull();
  });

  it('resolveActiveLocale respects explicit preference', () => {
    expect(
      resolveActiveLocale({
        preference: 'fr',
        deviceLocale: 'en-US',
      }),
    ).toBe('fr');
  });

  it('resolveActiveLocale uses device when auto', () => {
    expect(
      resolveActiveLocale({
        preference: 'auto',
        deviceLocale: 'pt-PT',
      }),
    ).toBe('pt');
  });

  it('resolveActiveLocale falls back to bundle default', () => {
    expect(
      resolveActiveLocale({
        preference: 'auto',
        deviceLocale: 'de-DE',
        bundleDefaultLocale: 'fr',
      }),
    ).toBe('fr');
  });

  it('resolveActiveLocale session override wins', () => {
    expect(
      resolveActiveLocale({
        preference: 'en',
        deviceLocale: 'en-US',
        sessionOverride: 'pt',
      }),
    ).toBe('pt');
  });

  it('resolveActiveLocale defaults to en', () => {
    expect(
      resolveActiveLocale({
        preference: 'auto',
        deviceLocale: 'de-DE',
      }),
    ).toBe('en');
  });
});
