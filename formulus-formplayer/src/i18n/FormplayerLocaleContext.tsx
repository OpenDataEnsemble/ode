import { createContext } from 'react';
import type { OdeUiLocale } from './localeUtils';

export const FormplayerLocaleContext = createContext<OdeUiLocale>('en');
