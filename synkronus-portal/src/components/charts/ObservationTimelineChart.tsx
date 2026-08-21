import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ObservationTimeline } from '../../api/synkronus/generated';
import { formatOverviewCount } from '../../lib/observationStatsCharts';
import { OverviewChartPanel } from './OverviewChartPanel';

export interface ObservationTimelineChartProps {
  timeline: ObservationTimeline;
  totalObservations: number;
}

export function ObservationTimelineChart({
  timeline,
  totalObservations,
}: ObservationTimelineChartProps) {
  const data = useMemo(
    () =>
      timeline.buckets.map(b => ({
        label: b.label,
        count: b.count,
      })),
    [timeline.buckets],
  );

  const subtitle = useMemo(() => {
    if (!timeline.rangeStart || !timeline.rangeEnd) {
      return undefined;
    }
    return `${timeline.rangeStart} — ${timeline.rangeEnd} · ${timeline.bucketUnit === 'week' ? 'weekly' : 'daily'} buckets`;
  }, [timeline]);

  if (totalObservations === 0 || data.length === 0) {
    return (
      <OverviewChartPanel
        title="Observations over time"
        subtitle="No dated observations">
        <p className="muted home-overview-chart-empty">
          Sync observations to see a timeline.
        </p>
      </OverviewChartPanel>
    );
  }

  return (
    <OverviewChartPanel
      title="Observations over time"
      subtitle={subtitle || undefined}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(107, 138, 232, 0.15)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--home-chart-tick)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--home-chart-axis)' }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: 'var(--home-chart-tick)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            cursor={{ fill: 'rgba(107, 138, 232, 0.08)' }}
            contentStyle={{
              background: 'var(--home-chart-tooltip-bg)',
              border: '1px solid var(--home-chart-tooltip-border)',
              borderRadius: 8,
              color: 'var(--home-chart-tooltip-fg)',
            }}
            formatter={value => {
              const count =
                typeof value === 'number' ? value : Number(value ?? 0);
              return [formatOverviewCount(count), 'Observations'];
            }}
            labelFormatter={label => `Period: ${label}`}
          />
          <Bar
            dataKey="count"
            fill="#6b8ae8"
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
          />
        </BarChart>
      </ResponsiveContainer>
    </OverviewChartPanel>
  );
}
