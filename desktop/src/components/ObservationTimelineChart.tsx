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
import type { ObservationOverviewTimeline } from '../types/domain';
import { formatOverviewCount } from '../lib/observationOverviewCharts';
import { OverviewChartPanel } from './OverviewChartPanel';

export interface ObservationTimelineChartProps {
  timeline: ObservationOverviewTimeline;
  totalObservations: number;
  embedded?: boolean;
  tall?: boolean;
}

export function ObservationTimelineChart({
  timeline,
  totalObservations,
  embedded = false,
  tall = false,
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
    const parts: string[] = [];
    if (timeline.rangeStart && timeline.rangeEnd) {
      parts.push(
        `${timeline.rangeStart} — ${timeline.rangeEnd} · ${timeline.bucketUnit === 'week' ? 'weekly' : 'daily'} buckets`,
      );
    }
    if (timeline.observationsWithoutDate > 0) {
      parts.push(
        `${formatOverviewCount(timeline.observationsWithoutDate)} without created date`,
      );
    }
    return parts.join(' · ');
  }, [timeline]);

  if (totalObservations === 0 || data.length === 0) {
    return (
      <OverviewChartPanel
        title="Observations over time"
        subtitle="No dated observations"
        embedded={embedded}>
        <p className="muted observations-overview-chart-empty">
          Add observations to see a timeline.
        </p>
      </OverviewChartPanel>
    );
  }

  const chartHeight = tall ? 320 : 220;

  return (
    <OverviewChartPanel
      title="Observations over time"
      subtitle={subtitle || undefined}
      embedded={embedded}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(144, 163, 203, 0.12)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#90a3cb', fontSize: 11 }}
            axisLine={{ stroke: '#2d3449' }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: '#90a3cb', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            cursor={{ fill: 'rgba(107, 138, 232, 0.08)' }}
            contentStyle={{
              background: '#131b2e',
              border: '1px solid #2d3449',
              borderRadius: 8,
              color: '#e8edf8',
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
