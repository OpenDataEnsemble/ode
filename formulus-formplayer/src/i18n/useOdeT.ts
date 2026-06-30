import { useContext } from 'react';
import { odeT } from './createOdeI18n';
import { FormplayerLocaleContext } from './FormplayerLocaleContext';

/** Translate ODE-owned chrome strings using the active Formplayer locale. */
export function useOdeT() {
  const locale = useContext(FormplayerLocaleContext);
  return (
    key: string,
    defaultMessage?: string,
    vars?: Record<string, string | number>,
  ) => odeT(locale, key, defaultMessage, vars);
}
