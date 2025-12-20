import {useState, useEffect, useCallback, useMemo} from 'react';
import {FormService} from '../services/FormService';
import {Observation} from '../database/models/Observation';
import {SortOption, FilterOption} from '../components/common/FilterBar';

interface UseObservationsResult {
  observations: Observation[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortOption: SortOption;
  setSortOption: (option: SortOption) => void;
  filterOption: FilterOption;
  setFilterOption: (option: FilterOption) => void;
  filteredAndSorted: Observation[];
}

export const useObservations = (): UseObservationsResult => {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOption, setSortOption] = useState<SortOption>('date-desc');
  const [filterOption, setFilterOption] = useState<FilterOption>('all');

  const loadObservations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const formService = await FormService.getInstance();
      const formSpecs = formService.getFormSpecs();
      const allObservations: Observation[] = [];
      for (const formSpec of formSpecs) {
        try {
          const formObservations = await formService.getObservationsByFormType(
            formSpec.id,
          );
          allObservations.push(...formObservations);
        } catch (err) {
          console.error(
            `Failed to load observations for form ${formSpec.id}:`,
            err,
          );
        }
      }

      setObservations(allObservations);
    } catch (err) {
      console.error('Failed to load observations:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load observations',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadObservations();
  }, [loadObservations]);

  const filteredAndSorted = useMemo(() => {
    let filtered = [...observations];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(obs => {
        try {
          const data =
            typeof obs.data === 'string' ? JSON.parse(obs.data) : obs.data;
          const dataStr = JSON.stringify(data).toLowerCase();
          return (
            obs.observationId.toLowerCase().includes(query) ||
            obs.formType.toLowerCase().includes(query) ||
            dataStr.includes(query)
          );
        } catch {
          return (
            obs.observationId.toLowerCase().includes(query) ||
            obs.formType.toLowerCase().includes(query)
          );
        }
      });
    }

    if (filterOption !== 'all') {
      filtered = filtered.filter(obs => {
        const isSynced =
          obs.syncedAt &&
          obs.syncedAt.getTime() > new Date('1980-01-01').getTime();
        return filterOption === 'synced' ? isSynced : !isSynced;
      });
    }

    filtered.sort((a, b) => {
      switch (sortOption) {
        case 'date-desc':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'date-asc':
          return a.createdAt.getTime() - b.createdAt.getTime();
        case 'form-type':
          return a.formType.localeCompare(b.formType);
        case 'sync-status': {
          const aSynced =
            a.syncedAt &&
            a.syncedAt.getTime() > new Date('1980-01-01').getTime();
          const bSynced =
            b.syncedAt &&
            b.syncedAt.getTime() > new Date('1980-01-01').getTime();
          if (aSynced === bSynced) return 0;
          return aSynced ? 1 : -1;
        }
        default:
          return 0;
      }
    });

    return filtered;
  }, [observations, searchQuery, sortOption, filterOption]);

  return {
    observations,
    loading,
    error,
    refresh: loadObservations,
    searchQuery,
    setSearchQuery,
    sortOption,
    setSortOption,
    filterOption,
    setFilterOption,
    filteredAndSorted,
  };
};
