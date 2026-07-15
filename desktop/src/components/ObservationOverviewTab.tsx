import { formatOverviewUpdatedAt } from '../lib/observationOverviewFormat';
import type { ObservationOverviewResult } from '../types/domain';
import { ObservationOverviewAccordion } from './ObservationOverviewAccordion';

export interface ObservationOverviewTabProps {
  data: ObservationOverviewResult | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function ObservationOverviewTab({
  data,
  loading,
  error,
  onRefresh,
}: ObservationOverviewTabProps) {
  return (
    <div className="observations-overview">
      <div className="observations-overview-toolbar">
        <button
          type="button"
          className="secondary btn-compact"
          disabled={loading}
          onClick={onRefresh}>
          Refresh
        </button>
        {data?.computedAt ? (
          <span className="muted observations-overview-updated">
            Last updated: {formatOverviewUpdatedAt(data.computedAt)}
          </span>
        ) : null}
      </div>

      {loading && !data ? <p className="muted">Loading…</p> : null}

      {error ? <p className="notice error">{error}</p> : null}

      {data ? <ObservationOverviewAccordion data={data} /> : null}

      {!loading && !error && data && data.rows.length === 0 ? (
        <p className="muted">No observations in this workspace yet.</p>
      ) : null}
    </div>
  );
}
