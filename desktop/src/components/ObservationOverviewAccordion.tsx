import { useState } from 'react';
import {
  formatObservationOverviewCell,
  formatOverviewCount,
} from '../lib/observationOverviewFormat';
import type { ObservationOverviewResult } from '../types/domain';
import { ObservationFormTypeChart } from './ObservationFormTypeChart';
import { ObservationMapChart } from './ObservationMapChart';
import { ObservationTimelineChart } from './ObservationTimelineChart';

type OverviewSection = 'charts' | 'map' | 'table';

export interface ObservationOverviewAccordionProps {
  data: ObservationOverviewResult;
}

export function ObservationOverviewAccordion({
  data,
}: ObservationOverviewAccordionProps) {
  const [openSection, setOpenSection] = useState<OverviewSection>('charts');
  const total = data.totals.observationCount;

  if (total === 0) {
    return null;
  }

  const sections: {
    id: OverviewSection;
    title: string;
    meta: string;
    icon: string;
  }[] = [
    {
      id: 'charts',
      title: 'Charts',
      meta: 'Timeline and form types',
      icon: 'bar_chart',
    },
    {
      id: 'map',
      title: 'Map',
      meta: `${formatOverviewCount(data.geolocationSummary.withLocation)} with GPS`,
      icon: 'map',
    },
    {
      id: 'table',
      title: 'Summary table',
      meta: `${formatOverviewCount(data.rows.length)} form types`,
      icon: 'table_rows',
    },
  ];

  function toggle(section: OverviewSection) {
    setOpenSection(prev => (prev === section ? prev : section));
  }

  return (
    <div className="observations-overview-accordion">
      {sections.map(section => {
        const isOpen = openSection === section.id;
        return (
          <div
            key={section.id}
            className={`observations-overview-accordion-item${isOpen ? ' is-open' : ''}`}>
            <button
              type="button"
              className="observations-overview-accordion-header"
              aria-expanded={isOpen}
              onClick={() => toggle(section.id)}>
              <span className="material-symbols-outlined" aria-hidden>
                {isOpen ? 'expand_more' : 'chevron_right'}
              </span>
              <span
                className="material-symbols-outlined observations-overview-accordion-icon"
                aria-hidden>
                {section.icon}
              </span>
              <span className="observations-overview-accordion-title">
                {section.title}
              </span>
              <span className="muted observations-overview-accordion-meta">
                {section.meta}
              </span>
            </button>
            {isOpen ? (
              <div className="observations-overview-accordion-body">
                {section.id === 'charts' ? (
                  <div className="observations-overview-charts-row observations-overview-charts-row--accordion">
                    <ObservationTimelineChart
                      timeline={data.timeline}
                      totalObservations={total}
                      embedded
                      tall
                    />
                    <ObservationFormTypeChart
                      rows={data.rows}
                      totalObservations={total}
                      embedded
                      tall
                    />
                  </div>
                ) : null}
                {section.id === 'map' ? (
                  <ObservationMapChart
                    map={data.map}
                    geolocationSummary={data.geolocationSummary}
                    totalObservations={total}
                    embedded
                    tall
                  />
                ) : null}
                {section.id === 'table' ? (
                  <table className="form-table observations-overview-table observations-overview-table--accordion">
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
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
