import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { ObservationFormTypeCount } from '../../api/synkronus/generated';
import {
  buildFormTypeChartSlices,
  formatOverviewCount,
} from '../../lib/observationStatsCharts';
import { OverviewChartPanel } from './OverviewChartPanel';

export interface ObservationFormTypeChartProps {
  rows: ObservationFormTypeCount[];
  totalObservations: number;
}

export function ObservationFormTypeChart({
  rows,
  totalObservations,
}: ObservationFormTypeChartProps) {
  const slices = useMemo(() => buildFormTypeChartSlices(rows), [rows]);

  if (totalObservations === 0 || slices.length === 0) {
    return (
      <OverviewChartPanel title="Form types" subtitle="No observations">
        <p className="muted home-overview-chart-empty">
          No form types to display.
        </p>
      </OverviewChartPanel>
    );
  }

  return (
    <OverviewChartPanel
      title="Form types"
      subtitle={`${slices.length} ${slices.length === 1 ? 'category' : 'categories'} · ${formatOverviewCount(totalObservations)} total`}>
      <div className="home-overview-donut-layout">
        <div className="home-overview-donut-wrap">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={slices}
                dataKey="count"
                nameKey="formType"
                innerRadius={52}
                outerRadius={78}
                paddingAngle={2}
                stroke="var(--home-chart-donut-stroke)"
                strokeWidth={2}>
                {slices.map(slice => (
                  <Cell key={slice.formType} fill={slice.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--home-chart-tooltip-bg)',
                  border: '1px solid var(--home-chart-tooltip-border)',
                  borderRadius: 8,
                  color: 'var(--home-chart-tooltip-fg)',
                }}
                formatter={(value, _name, item) => {
                  const count =
                    typeof value === 'number' ? value : Number(value ?? 0);
                  const pct =
                    totalObservations > 0
                      ? ((count / totalObservations) * 100).toFixed(1)
                      : '0';
                  const formType =
                    item && typeof item === 'object' && 'payload' in item
                      ? String(
                          (item.payload as { formType?: string }).formType ??
                            '',
                        )
                      : '';
                  return [`${formatOverviewCount(count)} (${pct}%)`, formType];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="home-overview-donut-center" aria-hidden>
            <span className="home-overview-donut-total">
              {formatOverviewCount(totalObservations)}
            </span>
            <span className="muted">total</span>
          </div>
        </div>
        <ul className="home-overview-legend">
          {slices.map(slice => (
            <li key={slice.formType}>
              <span
                className="home-overview-legend-swatch"
                style={{ background: slice.color }}
              />
              <span className="home-overview-legend-label">
                {slice.formType}
              </span>
              <span className="muted home-overview-legend-count">
                {formatOverviewCount(slice.count)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </OverviewChartPanel>
  );
}
