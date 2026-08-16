import { useState, useEffect, useCallback } from 'react';
import { FormService } from '../services/FormService';
import type { SyncStatus } from '../components/common/SyncStatusButtons';
import { logger } from '../diagnostics/logger';
import type {
  ObservationListPage,
  ObservationListRow,
} from '../database/observationListQuery';
import { OBSERVATION_LIST_PAGE_SIZE } from '../database/observationListQuery';

interface UseObservationsResult {
  rows: ObservationListRow[];
  total: number;
  totalPages: number;
  page: number;
  setPage: (page: number) => void;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedFormType: string | null;
  setSelectedFormType: (formType: string | null) => void;
  syncStatus: SyncStatus;
  setSyncStatus: (status: SyncStatus) => void;
}

export const useObservations = (): UseObservationsResult => {
  const [rows, setRows] = useState<ObservationListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPageState] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQueryState] = useState('');
  const [selectedFormType, setSelectedFormTypeState] = useState<string | null>(
    null,
  );
  const [syncStatus, setSyncStatusState] = useState<SyncStatus>('all');

  const loadPage = useCallback(async () => {
    const started = Date.now();
    logger.info('observations', 'load start', {
      screen: 'Observations',
      phase: 'start',
      counts: page,
    });
    try {
      setLoading(true);
      setError(null);
      const formService = await FormService.getInstance();
      const result: ObservationListPage =
        await formService.listObservationsPage({
          page,
          pageSize: OBSERVATION_LIST_PAGE_SIZE,
          formType: selectedFormType,
          syncStatus,
          search: searchQuery,
        });
      setRows(result.rows);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      if (page > result.totalPages) {
        setPageState(result.totalPages);
      }
      logger.info('observations', `load done in ${Date.now() - started}ms`, {
        screen: 'Observations',
        phase: 'done',
        counts: result.total,
        success: true,
      });
    } catch (err) {
      logger.error(
        'observations',
        err instanceof Error ? err.message : 'load failed',
        { screen: 'Observations', phase: 'done', success: false },
      );
      setError(
        err instanceof Error ? err.message : 'Failed to load observations',
      );
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, selectedFormType, syncStatus]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPage();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadPage]);

  const setPage = useCallback((nextPage: number) => {
    setPageState(nextPage);
    setLoading(true);
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
    setPageState(1);
    setLoading(true);
  }, []);

  const setSelectedFormType = useCallback((formType: string | null) => {
    setSelectedFormTypeState(formType);
    setPageState(1);
    setLoading(true);
  }, []);

  const setSyncStatus = useCallback((status: SyncStatus) => {
    setSyncStatusState(status);
    setPageState(1);
    setLoading(true);
  }, []);

  return {
    rows,
    total,
    totalPages,
    page,
    setPage,
    loading,
    error,
    refresh: loadPage,
    searchQuery,
    setSearchQuery,
    selectedFormType,
    setSelectedFormType,
    syncStatus,
    setSyncStatus,
  };
};
