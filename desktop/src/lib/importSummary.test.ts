import { describe, expect, it } from 'vitest';
import {
  extractObservationsFromJson,
  isImportObservationApparentlySynced,
  partitionImportObservationsBySyncAppearance,
  summarizeImportFiles,
  type ParsedObservationFile,
} from './importSummary';
import type { ApiObservation } from '../types/domain';

describe('extractObservationsFromJson', () => {
  it('parses Synkronus-style snake_case object', () => {
    const { observations, error } = extractObservationsFromJson(
      {
        observation_id: 'a1',
        data: { x: 1 },
        form_type: 'ft',
        updated_at: '2026-01-01T00:00:00Z',
      },
      'f.json',
    );
    expect(error).toBeUndefined();
    expect(observations).toHaveLength(1);
    expect(observations[0].observationId).toBe('a1');
    expect(observations[0].formType).toBe('ft');
  });

  it('parses camelCase ApiObservation', () => {
    const { observations } = extractObservationsFromJson(
      {
        observationId: 'b2',
        data: {},
        formType: 't2',
        updatedAt: '2026-02-02T00:00:00Z',
      },
      'f.json',
    );
    expect(observations).toHaveLength(1);
    expect(observations[0].observationId).toBe('b2');
  });

  it('parses root array', () => {
    const { observations } = extractObservationsFromJson(
      [
        { observationId: 'c1', data: {} },
        { observationId: 'c2', data: {} },
      ],
      'f.json',
    );
    expect(observations).toHaveLength(2);
  });

  it('parses envelope extras (geolocation, author, tags)', () => {
    const { observations } = extractObservationsFromJson(
      {
        observation_id: 'm1',
        data: { hh_hut_gps: '{"latitude":1}' },
        form_type: 'hh_hut',
        updated_at: '2024-07-03T14:39:06.407Z',
        geolocation: { latitude: 5.33, longitude: 36.07 },
        author: 'username:device02',
        tags: ['migrated'],
      },
      'f.json',
    );
    expect(observations).toHaveLength(1);
    expect(observations[0].extras?.geolocation).toEqual({
      latitude: 5.33,
      longitude: 36.07,
    });
    expect(observations[0].extras?.author).toBe('username:device02');
    expect(observations[0].extras?.tags).toEqual(['migrated']);
  });

  it('returns error when no ids', () => {
    const { observations, error } = extractObservationsFromJson(
      { foo: 1 },
      'f.json',
    );
    expect(observations).toHaveLength(0);
    expect(error).toBeTruthy();
  });
});

describe('summarizeImportFiles', () => {
  it('counts observations, form types, and non-json files', () => {
    const files: ParsedObservationFile[] = [
      {
        fileName: 'a.json',
        observations: [
          {
            observationId: '1',
            data: { attachments: [{ id: 'x' }] },
            formType: 'A',
            updatedAt: '2026-01-01T00:00:00Z',
          },
          {
            observationId: '2',
            data: {},
            formType: 'B',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        ],
      },
    ];
    const s = summarizeImportFiles(files, 2);
    expect(s.observationCount).toBe(2);
    expect(s.formTypeCount).toBe(2);
    expect(s.attachmentHintCount).toBeGreaterThanOrEqual(2);
  });
});

describe('isImportObservationApparentlySynced', () => {
  const base: ApiObservation = {
    observationId: 'o1',
    data: {},
    updatedAt: '2026-08-15T12:00:00.000Z',
  };

  it('is false when syncedAt is missing or null', () => {
    expect(isImportObservationApparentlySynced(base)).toBe(false);
    expect(
      isImportObservationApparentlySynced({
        ...base,
        extras: { syncedAt: null },
      }),
    ).toBe(false);
  });

  it('is true when updatedAt is at or before syncedAt', () => {
    expect(
      isImportObservationApparentlySynced({
        ...base,
        extras: { syncedAt: '2026-08-15T12:00:00.000Z' },
      }),
    ).toBe(true);
    expect(
      isImportObservationApparentlySynced({
        ...base,
        updatedAt: '2026-08-15T11:00:00.000Z',
        extras: { syncedAt: '2026-08-15T12:00:00.000Z' },
      }),
    ).toBe(true);
  });

  it('is false when updated after syncedAt (pending local edit)', () => {
    expect(
      isImportObservationApparentlySynced({
        ...base,
        updatedAt: '2026-08-15T13:00:00.000Z',
        extras: { syncedAt: '2026-08-15T12:00:00.000Z' },
      }),
    ).toBe(false);
  });

  it('ignores placeholder syncedAt before 1980', () => {
    expect(
      isImportObservationApparentlySynced({
        ...base,
        extras: { syncedAt: '1970-01-01T00:00:00.000Z' },
      }),
    ).toBe(false);
  });
});

describe('partitionImportObservationsBySyncAppearance', () => {
  it('splits synced vs unsynced rows', () => {
    const rows: ApiObservation[] = [
      {
        observationId: 'synced',
        data: {},
        updatedAt: '2026-01-01T00:00:00Z',
        extras: { syncedAt: '2026-01-02T00:00:00Z' },
      },
      {
        observationId: 'pending',
        data: {},
        updatedAt: '2026-01-03T00:00:00Z',
        extras: { syncedAt: '2026-01-02T00:00:00Z' },
      },
      {
        observationId: 'never',
        data: {},
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];
    const part = partitionImportObservationsBySyncAppearance(rows);
    expect(part.total).toBe(3);
    expect(part.apparentlySynced.map(o => o.observationId)).toEqual(['synced']);
    expect(part.unsynced.map(o => o.observationId)).toEqual([
      'pending',
      'never',
    ]);
  });
});
