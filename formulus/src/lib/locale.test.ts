import {
  localeLookupCandidates,
  matchOdeCatalogLocale,
  normalizeLocaleTag,
  resolveActiveLocale,
} from './locale';
import en from '../locales/en.json';
import sw from '../locales/sw.json';

describe('locale', () => {
  it('normalizes locale tags', () => {
    expect(normalizeLocaleTag('pt_BR')).toBe('pt-br');
    expect(normalizeLocaleTag('  EN  ')).toBe('en');
  });

  it('builds lookup candidates', () => {
    expect(localeLookupCandidates('pt-BR')).toEqual(['pt-br', 'pt']);
    expect(localeLookupCandidates('en')).toEqual(['en']);
    expect(localeLookupCandidates('sw-KE')).toEqual(['sw-ke', 'sw']);
  });

  it('matches ODE catalog locales', () => {
    expect(matchOdeCatalogLocale('pt-BR')).toBe('pt');
    expect(matchOdeCatalogLocale('sw')).toBe('sw');
    expect(matchOdeCatalogLocale('sw-KE')).toBe('sw');
    expect(matchOdeCatalogLocale('sw-TZ')).toBe('sw');
    expect(matchOdeCatalogLocale('sw-UG')).toBe('sw');
    expect(matchOdeCatalogLocale('de')).toBeNull();
  });

  it('resolveActiveLocale respects explicit preference', () => {
    expect(
      resolveActiveLocale({
        preference: 'fr',
        deviceLocale: 'en-US',
      }),
    ).toBe('fr');
    expect(
      resolveActiveLocale({
        preference: 'sw',
        deviceLocale: 'en-US',
      }),
    ).toBe('sw');
  });

  it('resolveActiveLocale uses device when auto', () => {
    expect(
      resolveActiveLocale({
        preference: 'auto',
        deviceLocale: 'pt-PT',
      }),
    ).toBe('pt');
    expect(
      resolveActiveLocale({
        preference: 'auto',
        deviceLocale: 'sw-KE',
      }),
    ).toBe('sw');
    expect(
      resolveActiveLocale({
        preference: 'auto',
        deviceLocale: 'sw-TZ',
      }),
    ).toBe('sw');
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

  it('Swahili catalog matches English keys and is not an English fallback', () => {
    const enKeys = Object.keys(en).sort();
    const swKeys = Object.keys(sw).sort();
    expect(swKeys).toEqual(enKeys);
    expect(sw['tabs.sync']).toBe('Sawazisha');
    expect(sw['tabs.sync']).not.toBe(en['tabs.sync']);
  });
});
