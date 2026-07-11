import {
  formatObservationOverviewCell,
  formatOverviewUpdatedAt,
} from '../lib/observationOverviewFormat';
import type { ObservationOverviewResult } from '../types/domain';

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

      {loading && !data ? (
        <p className="muted">Loading…</p>
      ) : null}

      {error ? <p className="notice error">{error}</p> : null}

      {data ? (
        <table className="form-table observations-overview-table">
          <thead>
            <tr>
              <th scope="col">Form type</th>
              <th scope="col">No. of observations (pending sync)</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map(row => (
              <tr key={row.formType}>
                <td>{row.formType}</td>
                <td>
                  {formatObservationOverviewCell(
                    row.observationCount,
                    row.pendingSyncCount,
                  )}
                </td>
              </tr>
            ))}
            <tr className="observations-overview-totals-row">
              <th scope="row">Totals</th>
              <td>
                {formatObservationOverviewCell(
                  data.totals.observationCount,
                  data.totals.pendingSyncCount,
                )}
              </td>
            </tr>
          </tbody>
        </table>
      ) : null}

      {!loading && !error && data && data.rows.length === 0 ? (
        <p className="muted">No observations in this workspace yet.</p>
      ) : null}
    </div>
  );
}
