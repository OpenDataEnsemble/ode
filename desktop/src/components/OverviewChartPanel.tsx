import type { ReactNode } from 'react';

export interface OverviewChartPanelProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  /** When true, omit outer panel chrome (for accordion sections). */
  embedded?: boolean;
}

export function OverviewChartPanel({
  title,
  subtitle,
  children,
  className,
  embedded = false,
}: OverviewChartPanelProps) {
  if (embedded) {
    return (
      <div
        className={`observations-overview-chart-embedded${className ? ` ${className}` : ''}`}>
        <div className="observations-overview-chart-header">
          <h4>{title}</h4>
          {subtitle ? (
            <p className="muted observations-overview-chart-subtitle">
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="observations-overview-chart-body">{children}</div>
      </div>
    );
  }

  return (
    <div
      className={`panel observations-overview-chart${className ? ` ${className}` : ''}`}>
      <div className="observations-overview-chart-header">
        <h3>{title}</h3>
        {subtitle ? (
          <p className="muted observations-overview-chart-subtitle">
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className="observations-overview-chart-body">{children}</div>
    </div>
  );
}
