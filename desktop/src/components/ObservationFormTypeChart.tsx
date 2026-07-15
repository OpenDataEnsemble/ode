import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  buildFormTypeChartSlices,
  formatOverviewCount,
} from '../lib/observationOverviewCharts';
import type { ObservationOverviewRow } from '../types/domain';
import { OverviewChartPanel } from './OverviewChartPanel';

export interface ObservationFormTypeChartProps {
  rows: ObservationOverviewRow[];
  totalObservations: number;
  embedded?: boolean;
  tall?: boolean;
}

export function ObservationFormTypeChart({
  rows,
  totalObservations,
  embedded = false,
  tall = false,
}: ObservationFormTypeChartProps) {
  const slices = useMemo(() => buildFormTypeChartSlices(rows), [rows]);

  if (totalObservations === 0 || slices.length === 0) {
    return (
      <OverviewChartPanel
        title="Form types"
        subtitle="No observations"
        embedded={embedded}>
        <p className="muted observations-overview-chart-empty">
          No form types to display.
        </p>
      </OverviewChartPanel>
    );
  }

  const chartHeight = tall ? 280 : 200;
  const legendMaxHeight = tall ? 280 : 200;

  return (
    <OverviewChartPanel
      title="Form types"
      subtitle={`${slices.length} ${slices.length === 1 ? 'category' : 'categories'} · ${formatOverviewCount(totalObservations)} total`}
      embedded={embedded}>
      <div className="observations-overview-donut-layout">
        <div
          className="observations-overview-donut-wrap"
          style={tall ? { minHeight: chartHeight } : undefined}>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <Pie
                data={slices}
                dataKey="count"
                nameKey="formType"
                innerRadius={52}
                outerRadius={78}
                paddingAngle={2}
                stroke="#131b2e"
                strokeWidth={2}>
                {slices.map(slice => (
                  <Cell key={slice.formType} fill={slice.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#131b2e',
                  border: '1px solid #2d3449',
                  borderRadius: 8,
                  color: '#e8edf8',
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
          <div className="observations-overview-donut-center" aria-hidden>
            <span className="observations-overview-donut-total">
              {formatOverviewCount(totalObservations)}
            </span>
            <span className="muted">total</span>
          </div>
        </div>
        <ul
          className="observations-overview-legend"
          style={tall ? { maxHeight: legendMaxHeight } : undefined}>
          {slices.map(slice => (
            <li key={slice.formType}>
              <span
                className="observations-overview-legend-swatch"
                style={{ background: slice.color }}
              />
              <span className="observations-overview-legend-label">
                {slice.formType}
              </span>
              <span className="muted observations-overview-legend-count">
                {formatOverviewCount(slice.count)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </OverviewChartPanel>
  );
}
