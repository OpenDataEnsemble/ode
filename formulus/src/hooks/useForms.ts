import {useState, useEffect, useCallback} from 'react';
import {FormService, FormSpec} from '../services/FormService';

interface UseFormsResult {
  forms: FormSpec[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getObservationCount: (formId: string) => number;
  observationCounts: Record<string, number>;
}

export const useForms = (): UseFormsResult => {
  const [forms, setForms] = useState<FormSpec[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [observationCounts, setObservationCounts] = useState<
    Record<string, number>
  >({});

  const loadForms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const formService = await FormService.getInstance();
      const formSpecs = formService.getFormSpecs();
      setForms(formSpecs);

      const counts: Record<string, number> = {};
      for (const form of formSpecs) {
        try {
          const observations = await formService.getObservationsByFormType(
            form.id,
          );
          counts[form.id] = observations.length;
        } catch (err) {
          console.error(
            `Failed to load observations for form ${form.id}:`,
            err,
          );
          counts[form.id] = 0;
        }
      }
      setObservationCounts(counts);
    } catch (err) {
      console.error('Failed to load forms:', err);
      setError(err instanceof Error ? err.message : 'Failed to load forms');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadForms();
    const formServicePromise = FormService.getInstance();
    formServicePromise.then(service => {
      service.onCacheInvalidated(() => {
        loadForms();
      });
    });
  }, [loadForms]);

  const getObservationCount = useCallback(
    (formId: string): number => {
      return observationCounts[formId] || 0;
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
