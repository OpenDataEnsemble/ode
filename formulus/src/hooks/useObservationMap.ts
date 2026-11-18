import { useCallback, useEffect, useRef, useState } from 'react';
import { FormService } from '../services/FormService';
import { logger } from '../diagnostics/logger';
import type { SyncStatus } from '../components/common/SyncStatusButtons';
import type { ObservationMapResult } from '../database/observationMapQuery';
import type { Basemap } from '../maps/basemap';
import { checkBasemapOnline, loadBasemap } from '../maps/BasemapService';

const EMPTY: ObservationMapResult = {
  points: [],
  total: 0,
  withoutLocation: 0,
  truncated: false,
};

/** Filter changes arrive per keystroke from search; coalesce them. */
const FILTER_DEBOUNCE_MS = 250;

type Filters = {
  formType: string | null;
  syncStatus: SyncStatus;
  search: string;
};

/**
 * Located observations + basemap for the Observations map. Everything shown
 * comes from the device; the network is only checked in the background to
 * tell the user whether the map background can load. Does nothing while
 * `enabled` is false, so the List view never pays for the map.
 */
export function useObservationMap(enabled: boolean, filters: Filters) {
  const [result, setResult] = useState<ObservationMapResult>(EMPTY);
  const [basemap, setBasemap] = useState<Basemap | null>(null);
  /** null until the background check answers. */
  const [online, setOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const { formType, syncStatus, search } = filters;

  const loadPoints = useCallback(async () => {
    const id = ++requestId.current;
    const started = Date.now();
    setLoading(true);
    setError(null);
    try {
      const formService = await FormService.getInstance();
      const points = await formService.listObservationMapPoints({
        formType,
        syncStatus,
        search,
      });
      if (id !== requestId.current) return;
      setResult(points);
      logger.info(
        'observations',
        `map load done in ${Date.now() - started}ms`,
        {
          screen: 'Observations',
          phase: 'done',
          counts: points.points.length,
          success: true,
        },
      );
    } catch (err) {
      if (id !== requestId.current) return;
      const message =
        err instanceof Error ? err.message : 'Failed to load the map';
      logger.error('observations', message, {
        screen: 'Observations',
        phase: 'done',
        success: false,
      });
      setError(message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [formType, syncStatus, search]);

  const loadBackground = useCallback(async () => {
    try {
      setBasemap(await loadBasemap());
    } catch (err) {
      logger.warn(
        'map',
        err instanceof Error ? err.message : 'Basemap unavailable',
      );
    }
    try {
      const check = await checkBasemapOnline();
      setOnline(check.online);
      if (check.styleUpdated) {
        setBasemap(await loadBasemap());
      }
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => {
      void loadPoints();
    }, FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [enabled, loadPoints]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => {
      void loadBackground();
    }, 0);
    return () => clearTimeout(timer);
  }, [enabled, loadBackground]);

  const refresh = useCallback(async () => {
    await Promise.all([loadPoints(), loadBackground()]);
  }, [loadPoints, loadBackground]);

  return { ...result, basemap, online, loading, error, refresh };
}
