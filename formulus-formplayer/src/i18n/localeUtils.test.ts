import { describe, expect, it } from 'vitest';
import { matchOdeCatalogLocale, resolveFormplayerLocale } from './localeUtils';
import { odeT } from './createOdeI18n';
import en from '../locales/en.json';
import sw from '../locales/sw.json';

describe('Formplayer locale resolution', () => {
  it('matches explicit sw and regional tags to the Swahili catalog', () => {
    expect(matchOdeCatalogLocale('sw')).toBe('sw');
    expect(matchOdeCatalogLocale('sw-KE')).toBe('sw');
    expect(matchOdeCatalogLocale('sw-TZ')).toBe('sw');
    expect(resolveFormplayerLocale('sw-KE')).toBe('sw');
    expect(resolveFormplayerLocale('sw-TZ')).toBe('sw');
  });

  it('Swahili catalog matches English keys and is not an English fallback', () => {
    const enKeys = Object.keys(en).sort();
    const swKeys = Object.keys(sw).sort();
    expect(swKeys).toEqual(enKeys);
    expect(odeT('sw', 'nav.nextScreen')).toBe('Skrini inayofuata');
    expect(odeT('sw', 'nav.nextScreen')).not.toBe(en['nav.nextScreen']);
  });
});
