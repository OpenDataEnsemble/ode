import {
  boundsOfPoints,
  buildObservationMapSql,
  framingPoints,
  mapObservationMapRow,
  OBSERVATION_MAP_POINT_LIMIT,
  parseObservationCoordinates,
} from '../observationMapQuery';
import { buildObservationListSql } from '../observationListQuery';

describe('buildObservationMapSql', () => {
  it('reads located rows only, never data, capped with one extra row', () => {
    const built = buildObservationMapSql({});
    expect(built.pointsSql).toContain('geolocation IS NOT NULL');
    expect(built.pointsSql).not.toMatch(/\bdata\b/);
    expect(built.pointsSql).toContain('LIMIT ?');
    expect(built.pointsParams.at(-1)).toBe(OBSERVATION_MAP_POINT_LIMIT + 1);
    expect(built.countSql).toBe(
      'SELECT COUNT(*) AS cnt FROM observations WHERE deleted = 0',
    );
  });

  it('applies exactly the same filters as the list', () => {
    const filters = {
      formType: 'water_point',
      syncStatus: 'pending' as const,
      search: 'abc',
    };
    const map = buildObservationMapSql(filters);
    const list = buildObservationListSql({ ...filters, page: 1 });
    expect(map.countSql).toBe(list.countSql);
    expect(map.countParams).toEqual(list.countParams);
    expect(map.pointsParams.slice(0, -1)).toEqual(list.countParams);
  });
});

describe('parseObservationCoordinates', () => {
  it('parses stored JSON', () => {
    expect(
      parseObservationCoordinates(
        JSON.stringify({ latitude: 0.3476, longitude: 32.5825, accuracy: 7 }),
      ),
    ).toEqual({ latitude: 0.3476, longitude: 32.5825, accuracy: 7 });
  });

  it.each([
    null,
    '',
    'not json',
    '{}',
    JSON.stringify({ latitude: 0, longitude: 0 }),
    JSON.stringify({ latitude: 95, longitude: 10 }),
    JSON.stringify({ latitude: 'x', longitude: 10 }),
  ])('rejects %p', raw => {
    expect(parseObservationCoordinates(raw)).toBeNull();
  });
});

describe('mapObservationMapRow', () => {
  it('maps a synced row', () => {
    const point = mapObservationMapRow({
      observation_id: 'obs-1',
      form_type: 'survey',
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
      synced_at: 1_700_000_100_000,
      geolocation: JSON.stringify({ latitude: 1, longitude: 2 }),
    });
    expect(point).toMatchObject({
      observationId: 'obs-1',
      formType: 'survey',
      synced: true,
      latitude: 1,
      longitude: 2,
      accuracy: null,
    });
  });

  it('marks edits after the last sync as pending', () => {
    const point = mapObservationMapRow({
      observation_id: 'obs-2',
      form_type: 'survey',
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_200_000,
      synced_at: 1_700_000_100_000,
      geolocation: JSON.stringify({ latitude: 1, longitude: 2 }),
    });
    expect(point?.synced).toBe(false);
  });
});

describe('framing', () => {
  const cluster = [
    { latitude: 0.31, longitude: 32.58 },
    { latitude: 0.32, longitude: 32.59 },
    { latitude: 0.33, longitude: 32.57 },
    { latitude: 0.315, longitude: 32.585 },
  ];

  it('drops a far outlier from the framing', () => {
    const outlier = { latitude: 51.5, longitude: -0.12 };
    const framed = framingPoints([...cluster, outlier]);
    expect(framed).toHaveLength(4);
    expect(framed).not.toContainEqual(outlier);
  });

  it('keeps everything when points are spread evenly', () => {
    expect(framingPoints(cluster)).toHaveLength(4);
  });

  it('computes bounds as west, south, east, north', () => {
    expect(boundsOfPoints(cluster)).toEqual([32.57, 0.31, 32.59, 0.33]);
    expect(boundsOfPoints([])).toBeNull();
  });
});
