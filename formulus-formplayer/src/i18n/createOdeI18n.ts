import type { ErrorObject } from 'ajv';
import type { JsonFormsI18nState, Translator } from '@jsonforms/core';
import en from '../locales/en.json';
import pt from '../locales/pt.json';
import fr from '../locales/fr.json';
import type { OdeUiLocale } from './localeUtils';

type Catalog = Record<string, string>;

const CATALOGS: Record<OdeUiLocale, Catalog> = {
  en: en as Catalog,
  pt: pt as Catalog,
  fr: fr as Catalog,
};

/** Simple {{key}} interpolation for catalog strings. */
export function interpolate(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const val = vars[key];
    return val !== undefined ? String(val) : `{{${key}}}`;
  });
}

export function getOdeCatalog(locale: OdeUiLocale): Catalog {
  return CATALOGS[locale] ?? CATALOGS.en;
}

export function odeT(
  locale: OdeUiLocale,
  key: string,
  defaultMessage?: string,
  vars?: Record<string, string | number>,
): string {
  const catalog = getOdeCatalog(locale);
  const raw = catalog[key] ?? defaultMessage ?? key;
  return interpolate(raw, vars);
}

/**
 * JsonForms-compatible i18n state for ODE-owned chrome and validation messages.
 */
export function createOdeI18n(locale: OdeUiLocale): JsonFormsI18nState {
  const catalog = getOdeCatalog(locale);

  const translate: Translator = (
    key: string,
    defaultMessage?: string,
    _context?: unknown,
  ) => {
    if (defaultMessage === undefined) {
      return catalog[key] ?? undefined;
    }
    return catalog[key] ?? defaultMessage;
  };

  const translateError = (
    error: ErrorObject,
    t: typeof translate,
    _uischema?: unknown,
  ): string => {
    const keyword = error.keyword;
    const limit =
      (error.params as { limit?: number })?.limit ??
      (error.params as { minimum?: number })?.minimum ??
      (error.params as { maximum?: number })?.maximum;

    const vars: Record<string, string | number> = {};
    if (limit !== undefined) vars.limit = limit;

    const ajvMessage =
      typeof error.message === 'string' ? error.message : undefined;

    if (keyword) {
      const fieldKey = `${String(error.instancePath).replace(/^\//, '').replace(/\//g, '.')}.error.${keyword}`;
      const fieldMsg = t(fieldKey, undefined);
      if (fieldMsg) return fieldMsg;

      const globalKey = `error.${keyword}`;
      const globalMsg = catalog[globalKey];
      if (globalMsg) return interpolate(globalMsg, vars);
    }

    if (ajvMessage) {
      const byMessage =
        catalog[`error.${ajvMessage}`] ?? t(ajvMessage, ajvMessage);
      if (byMessage) return interpolate(byMessage, vars);
    }

    return (
      ajvMessage ?? catalog['error.Validation error'] ?? 'Validation error'
    );
  };

  return {
    locale,
    translate,
    translateError,
  };
}

/** Translate a single AJV error for ODE-owned chrome (e.g. Finalize screen). */
export function translateAjvError(
  locale: OdeUiLocale,
  error: ErrorObject,
): string {
  const { translate, translateError } = createOdeI18n(locale);
  if (!translate || !translateError) {
    return typeof error.message === 'string'
      ? error.message
      : odeT(locale, 'error.Validation error', 'Validation error');
  }
  return translateError(error, translate);
}
