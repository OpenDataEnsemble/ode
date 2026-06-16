import { createContext, useContext } from 'react';

export type LabelLayout = 'inline' | 'stacked';

export interface FormDensityContextValue {
  labelLayout: LabelLayout;
}

export const FormDensityContext = createContext<FormDensityContextValue>({
  labelLayout: 'stacked',
});

export const useFormDensity = () => useContext(FormDensityContext);
