/**
 * FormEvaluationContext.tsx
 *
 * Provides extension functions to form evaluation context.
 * Allows renderers and other form components to access custom functions
 * defined in ext.json files.
 */

import React, { createContext, useContext, ReactNode } from 'react';

/**
 * Context value for form evaluation
 */
export interface FormEvaluationContextValue {
  /**
   * Map of loaded extension functions
   * Key: function name (e.g., "getDynamicChoiceList")
   * Value: the actual function
   */
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  functions: Map<string, Function>;
}

/**
 * Default context value (empty functions map)
 */
const defaultContextValue: FormEvaluationContextValue = {
  functions: new Map(),
};

/**
 * Form evaluation context
 */
const FormEvaluationContext =
  createContext<FormEvaluationContextValue>(defaultContextValue);

/**
 * Hook to access form evaluation context
 * @returns FormEvaluationContextValue with extension functions
 */
export function useFormEvaluation(): FormEvaluationContextValue {
  return useContext(FormEvaluationContext);
}

/**
 * Props for FormEvaluationProvider
 */
export interface FormEvaluationProviderProps {
  /**
   * Map of extension functions to provide
   */
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  functions: Map<string, Function>;
  /**
   * Child components
   */
  children: ReactNode;
}

/**
 * Provider component that makes extension functions available to child components
 */
export function FormEvaluationProvider({
  functions,
  children,
}: FormEvaluationProviderProps) {
  const value: FormEvaluationContextValue = {
    functions: functions ?? new Map(),
  };

  return (
    <FormEvaluationContext.Provider value={value}>
      {children}
    </FormEvaluationContext.Provider>
  );
}
