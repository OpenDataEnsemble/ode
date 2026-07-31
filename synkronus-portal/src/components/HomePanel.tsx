import { useCallback, useEffect, useState } from 'react';
import { Button } from '@ode/components/react-web';
import { HiArrowPath } from 'react-icons/hi2';
import type { ObservationStatsResponse } from '../api/synkronus/generated';
import { api } from '../services/api';
import { formatOverviewCount } from '../lib/observationStatsCharts';
import noDataIllustration from '../assets/nodata.png';
import { ObservationFormTypeChart } from './charts/ObservationFormTypeChart';
import { ObservationTimelineChart } from './charts/ObservationTimelineChart';

export function HomePanel() {
  const [stats, setStats] = useState<ObservationStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getObservationStats();
      setStats(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load observation stats',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void api
      .getObservationStats()
      .then(result => {
        if (cancelled) return;
        setStats(result);
        setError(null);
      })
      .catch(err => {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load observation stats',
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const total = stats?.totalCount ?? 0;

  return (
    <div className="home-section">
      <div className="section-header">
        <div className="section-title">
          <h2>Data overview</h2>
        </div>
        <div className="section-actions">
          <Button
            variant="neutral"
            onPress={() => void loadStats()}
            disabled={loading}
            loading={loading}>
            <HiArrowPath aria-hidden />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="alert-banner error home-stats-error">
          <span>{error}</span>
          <Button variant="neutral" onPress={() => void loadStats()}>
            Retry
          </Button>
        </div>
      )}

      {loading && !stats && (
        <div className="home-stats-loading muted">
          Loading observation stats…
        </div>
      )}

      {stats && !error && total === 0 && (
        <div className="home-stats-empty">
          <img
            src={noDataIllustration}
            alt=""
            className="home-stats-empty-illustration"
          />
          <p className="home-stats-empty-title">This server contains no observations yet</p>
        </div>
      )}

      {stats && total > 0 && (
        <>
          <p className="home-stats-summary">
            <strong>{formatOverviewCount(total)}</strong> observation
            {total === 1 ? '' : 's'}
            {stats.computedAt
              ? ` · updated ${new Date(stats.computedAt).toLocaleString()}`
              : ''}
          </p>
          <div className="home-overview-charts-row">
            <ObservationTimelineChart
              timeline={stats.timeline}
              totalObservations={total}
            />
            <ObservationFormTypeChart
              rows={stats.byFormType}
              totalObservations={total}
            />
          </div>
        </>
      )}
    </div>
  );
}
