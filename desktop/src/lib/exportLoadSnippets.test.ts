import {
  buildExportLoadSnippet,
  PARQUET_PATH_PLACEHOLDER,
  resolveSnippetParquetFiles,
  sanitizeExportIdentifier,
} from './exportLoadSnippets';

describe('exportLoadSnippets', () => {
  it('sanitizes identifiers', () => {
    expect(sanitizeExportIdentifier('censo_milda')).toBe('censo_milda');
    expect(sanitizeExportIdentifier('hh-person')).toBe('hh_person');
    expect(sanitizeExportIdentifier('2bad')).toBe('f_2bad');
  });

  it('uses path placeholders before export', () => {
    const files = resolveSnippetParquetFiles(null, ['household', 'person']);
    expect(files.household).toBe(PARQUET_PATH_PLACEHOLDER);
    expect(files.person).toBe(PARQUET_PATH_PLACEHOLDER);
    const code = buildExportLoadSnippet('r', files);
    expect(code).toContain(
      `household <- read_parquet("${PARQUET_PATH_PLACEHOLDER}")`,
    );
  });

  it('falls back to form_type placeholder when no form types known', () => {
    const files = resolveSnippetParquetFiles(null, []);
    expect(files).toEqual({ form_type: PARQUET_PATH_PLACEHOLDER });
  });

  it('builds R snippet with form-type variables', () => {
    const code = buildExportLoadSnippet('r', {
      person: '/tmp/out/person.parquet',
      household: '/tmp/out/household.parquet',
    });
    expect(code).toContain('library(arrow)');
    expect(code).toContain(
      'household <- read_parquet("/tmp/out/household.parquet")',
    );
    expect(code).toContain('person <- read_parquet("/tmp/out/person.parquet")');
  });

  it('builds Stata 19 import parquet frames', () => {
    const code = buildExportLoadSnippet('stata', {
      person: '/tmp/out/person.parquet',
      household: 'C:\\data\\household.parquet',
    });
    expect(code).toContain('import parquet using');
    expect(code).toContain('frame create household');
    expect(code).toContain(
      'frame household: import parquet using C:/data/household.parquet, clear',
    );
    expect(code).toContain(
      'frame person: import parquet using /tmp/out/person.parquet, clear',
    );
    expect(code).not.toContain('python:');
  });

  it('builds Python and Julia snippets', () => {
    const py = buildExportLoadSnippet('python', {
      censo: 'C:\\data\\censo.parquet',
    });
    expect(py).toContain('import pandas as pd');
    expect(py).toContain('censo = pd.read_parquet(r"C:\\data\\censo.parquet")');

    const jl = buildExportLoadSnippet('julia', {
      censo: '/tmp/censo.parquet',
    });
    expect(jl).toContain('using Parquet2, DataFrames');
    expect(jl).toContain(
      'censo = DataFrame(Parquet2.Dataset("/tmp/censo.parquet"))',
    );
  });
});
