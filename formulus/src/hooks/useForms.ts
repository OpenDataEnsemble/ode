import { useState, useEffect, useCallback, useRef } from 'react';
import { FormService, FormSpec } from '../services/FormService';

interface UseFormsResult {
  forms: FormSpec[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getObservationCount: (formId: string) => number | undefined;
  observationCounts: Record<string, number>;
}

export const useForms = (): UseFormsResult => {
  const [forms, setForms] = useState<FormSpec[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [observationCounts, setObservationCounts] = useState<
    Record<string, number>
  >({});
  const cancelledRef = useRef(false);

  const loadForms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const formService = await FormService.getInstance();
      const formSpecs = formService.getFormSpecs();
      if (cancelledRef.current) {
        return;
      }
      setForms(formSpecs);
      setLoading(false);

      for (const form of formSpecs) {
        if (cancelledRef.current) {
          return;
        }
        try {
          const page = await formService.listObservationsPage({
            page: 1,
            pageSize: 1,
            formType: form.id,
          });
          if (cancelledRef.current) {
            return;
          }
          setObservationCounts(prev => ({
            ...prev,
            [form.id]: page.total,
          }));
        } catch (err) {
          console.error(
            `Failed to load observations for form ${form.id}:`,
            err,
          );
          if (!cancelledRef.current) {
            setObservationCounts(prev => ({ ...prev, [form.id]: 0 }));
          }
        }
      }
    } catch (err) {
      console.error('Failed to load forms:', err);
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load forms');
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    const timer = setTimeout(() => {
      if (!cancelledRef.current) {
        void loadForms();
      }
    }, 0);
    const formServicePromise = FormService.getInstance();
    formServicePromise.then(service => {
      service.onCacheInvalidated(() => {
        void loadForms();
      });
    });
    return () => {
      cancelledRef.current = true;
      clearTimeout(timer);
    };
  }, [loadForms]);

  const getObservationCount = useCallback(
    (formId: string): number | undefined => {
      return Object.prototype.hasOwnProperty.call(observationCounts, formId)
        ? observationCounts[formId]
        : undefined;
    },
    [observationCounts],
  );

  return {
    forms,
    loading,
    error,
    refresh: loadForms,
    getObservationCount,
    observationCounts,
  };
};
