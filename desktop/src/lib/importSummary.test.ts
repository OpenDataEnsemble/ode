import { describe, expect, it } from 'vitest';
import {
  extractObservationsFromJson,
  summarizeImportFiles,
  type ParsedObservationFile,
} from './importSummary';

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
