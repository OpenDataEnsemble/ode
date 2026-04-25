import { describe, expect, it } from 'vitest';
import type { BundleFormSpec } from '../types/domain';
import {
  computeStagingKey,
  fileKeyForStaging,
  runImportValidation,
} from './importValidation';
import type { ParsedObservationFile } from './importSummary';

describe('runImportValidation', () => {
  const simplePhotoForm: BundleFormSpec = {
    formType: 'PhotoForm',
    formSchema: {
      type: 'object',
      properties: {
        pic: { type: 'object', format: 'photo' },
      },
    },
    uiSchema: {},
  };

  it('reports schema error when data does not match schema', () => {
    const parsed: ParsedObservationFile[] = [
      {
        fileName: 'a.json',
        observations: [
          {
            observationId: 'o1',
            formType: 'PhotoForm',
            data: { pic: 'not-an-object' },
            updatedAt: '2026-01-01T00:00:00Z',
          },
        ],
      },
    ];
    const report = runImportValidation({
      parsedFiles: parsed,
      formSpecsByType: new Map([['PhotoForm', simplePhotoForm]]),
      stagedAttachmentBasenames: [],
    });
    expect(report.issues.some(i => i.code === 'schema_validation')).toBe(true);
  });

  it('reports missing staged attachment referenced from payload', () => {
    const parsed: ParsedObservationFile[] = [
      {
        fileName: 'a.json',
        observations: [
          {
            observationId: 'o1',
            formType: 'PhotoForm',
            data: { pic: { filename: 'missing.jpg' } },
            updatedAt: '2026-01-01T00:00:00Z',
          },
        ],
      },
    ];
    const report = runImportValidation({
      parsedFiles: parsed,
      formSpecsByType: new Map([['PhotoForm', simplePhotoForm]]),
      stagedAttachmentBasenames: [],
    });
    expect(report.missingAttachmentNames).toContain('missing.jpg');
    expect(report.issues.some(i => i.code === 'missing_attachment')).toBe(true);
  });

  it('reports orphan staged attachment', () => {
    const parsed: ParsedObservationFile[] = [
      {
        fileName: 'a.json',
        observations: [
          {
            observationId: 'o1',
            formType: 'PhotoForm',
            data: { pic: { filename: 'used.jpg' } },
            updatedAt: '2026-01-01T00:00:00Z',
          },
        ],
      },
    ];
    const report = runImportValidation({
      parsedFiles: parsed,
      formSpecsByType: new Map([['PhotoForm', simplePhotoForm]]),
      stagedAttachmentBasenames: ['used.jpg', 'extra.png'],
    });
    expect(report.orphanAttachmentNames).toContain('extra.png');
  });

  it('records parse errors per file', () => {
    const parsed: ParsedObservationFile[] = [
      {
        fileName: 'bad.json',
        observations: [],
        error: 'Invalid JSON',
      },
    ];
    const report = runImportValidation({
      parsedFiles: parsed,
      formSpecsByType: new Map(),
      stagedAttachmentBasenames: [],
    });
    expect(report.issues.some(i => i.code === 'parse_file')).toBe(true);
  });
});

describe('staging keys', () => {
  it('fileKeyForStaging is stable for the same file metadata', () => {
    const f = new File(['x'], 't.json', { type: 'application/json' });
    expect(fileKeyForStaging(f)).toBe(fileKeyForStaging(f));
  });

  it('computeStagingKey distinguishes json vs attachment lists', () => {
    const j = new File(['{}'], 'a.json', { type: 'application/json' });
    const a = new File(['x'], 'b.png', { type: 'image/png' });
    const k1 = computeStagingKey([{ file: j }], []);
    const k2 = computeStagingKey([], [{ file: a }]);
    expect(k1).not.toBe(k2);
  });
});
