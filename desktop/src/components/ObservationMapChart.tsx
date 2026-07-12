import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import {
  colorForFormType,
  formatOverviewCount,
} from '../lib/observationOverviewCharts';
import type {
  ObservationGeolocationSummary,
  ObservationMapPoint,
  ObservationOverviewMap,
} from '../types/domain';
import { OverviewChartPanel } from './OverviewChartPanel';

// Default Leaflet marker assets break under Vite bundling.
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function formTypeColorIndex(formType: string, formTypes: string[]): number {
  const idx = formTypes.indexOf(formType);
  return idx >= 0 ? idx : 0;
}

function MapResizeOnMount() {
  const map = useMap();
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 0);
    return () => window.clearTimeout(id);
  }, [map]);
  return null;
}

function MapMarkers({ points }: { points: ObservationMapPoint[] }) {
  const map = useMap();
  const formTypes = useMemo(
    () => [...new Set(points.map(p => p.formType))].sort(),
    [points],
  );

  useEffect(() => {
    if (points.length === 0) {
      map.setView([20, 0], 2);
      return undefined;
    }

    const group = L.markerClusterGroup({
      maxClusterRadius: 48,
      showCoverageOnHover: false,
    });

    for (const point of points) {
      const color = colorForFormType(
        point.formType,
        formTypeColorIndex(point.formType, formTypes),
      );
      const icon = L.divIcon({
        className: 'observations-overview-map-marker',
        html: `<span style="background:${color}"></span>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const marker = L.marker([point.latitude, point.longitude], { icon });
      marker.bindTooltip(
        `<strong>${point.formType}</strong><br>${point.id.slice(0, 36)}`,
        { direction: 'top' },
      );
      group.addLayer(marker);
    }

    map.addLayer(group);
    const bounds = group.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
    }

    return () => {
      map.removeLayer(group);
    };
  }, [formTypes, map, points]);

  return null;
}

export interface ObservationMapChartProps {
  map: ObservationOverviewMap;
  geolocationSummary: ObservationGeolocationSummary;
  totalObservations: number;
  embedded?: boolean;
  tall?: boolean;
}

export function ObservationMapChart({
  map,
  geolocationSummary,
  totalObservations,
  embedded = false,
  tall = false,
}: ObservationMapChartProps) {
  const subtitle = useMemo(() => {
    const parts = [
      `${formatOverviewCount(geolocationSummary.withLocation)} of ${formatOverviewCount(totalObservations)} with GPS`,
    ];
    if (map.truncated) {
      parts.push(
        `showing first ${formatOverviewCount(map.cap)} (map truncated)`,
      );
    }
    return parts.join(' · ');
  }, [
    geolocationSummary.withLocation,
    map.cap,
    map.truncated,
    totalObservations,
  ]);

  if (totalObservations === 0) {
    return (
      <OverviewChartPanel
        title="Observation map"
        subtitle="No observations"
        className="observations-overview-chart-map"
        embedded={embedded}>
        <p className="muted observations-overview-chart-empty">
          No locations to display.
        </p>
      </OverviewChartPanel>
    );
  }

  if (map.points.length === 0) {
    return (
      <OverviewChartPanel
        title="Observation map"
        subtitle="No geolocation data"
        className="observations-overview-chart-map"
        embedded={embedded}>
        <p className="muted observations-overview-chart-empty">
          Observations in this workspace do not include GPS coordinates yet.
        </p>
      </OverviewChartPanel>
    );
  }

  return (
    <OverviewChartPanel
      title="Observation map"
      subtitle={subtitle}
      className="observations-overview-chart-map"
      embedded={embedded}>
      <div
        className={`observations-overview-map-wrap${tall ? ' observations-overview-map-wrap--tall' : ''}`}>
        <MapContainer
          center={[0, 0]}
          zoom={2}
          scrollWheelZoom
          className="observations-overview-map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapResizeOnMount />
          <MapMarkers points={map.points} />
        </MapContainer>
      </div>
    </OverviewChartPanel>
  );
}
