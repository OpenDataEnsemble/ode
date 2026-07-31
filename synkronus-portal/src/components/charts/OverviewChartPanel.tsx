import type { ReactNode } from 'react';

export interface OverviewChartPanelProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export function OverviewChartPanel({
  title,
  subtitle,
  children,
  className,
}: OverviewChartPanelProps) {
  return (
    <div className={`home-overview-chart${className ? ` ${className}` : ''}`}>
      <div className="home-overview-chart-header">
        <h3>{title}</h3>
        {subtitle ? (
          <p className="home-overview-chart-subtitle muted">{subtitle}</p>
        ) : null}
      </div>
      <div className="home-overview-chart-body">{children}</div>
    </div>
  );
}
