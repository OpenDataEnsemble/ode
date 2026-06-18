import { createContext, useContext } from 'react';

export type LabelLayout = 'inline' | 'stacked';
export type GroupVariant = 'flat' | 'card';

export interface FormDensityContextValue {
  labelLayout: LabelLayout;
  groupVariant: GroupVariant;
}

export const FormDensityContext = createContext<FormDensityContextValue>({
  labelLayout: 'stacked',
  groupVariant: 'card',
});

export const useFormDensity = () => useContext(FormDensityContext);
