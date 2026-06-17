import * as fs from 'fs';
import * as path from 'path';
import { compileObservationQuery, indexKeysFromConfig } from './compiler';
import type { ObservationIndexDef } from './types';

const fixturesDir = path.join(__dirname, '..', 'fixtures');

type FixtureFile = {
  name: string;
  jsonColumn: 'data' | 'payload';
  formType: string;
  includeDeleted?: boolean;
  indexKeys?: string[];
  filter?: unknown;
  expectedSqlFragments?: string[];
  expectedSqlFragmentsByDialect?: Partial<
    Record<'desktop' | 'formulus', string[]>
  >;
  expectError?: boolean;
  expectedErrorCode?: string;
  expectWarning?: boolean;
};

function expectedFragments(
  fixture: FixtureFile,
  dialect: 'desktop' | 'formulus',
): string[] {
  return (
    fixture.expectedSqlFragmentsByDialect?.[dialect] ??
    fixture.expectedSqlFragments ??
    []
  );
}

function loadFixtures(): FixtureFile[] {
  return fs
    .readdirSync(fixturesDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(fixturesDir, f), 'utf8')) as FixtureFile);
}

describe('ObservationQueryCompiler form_type wildcard', () => {
  it("omits the form_type = ? predicate when formType is '*'", () => {
    const result = compileObservationQuery({
      dialect: 'formulus',
      jsonColumn: 'data',
      tableAlias: 'observations',
      observationsTable: 'observations',
      indexKeys: new Set<string>(),
      formType: '*',
      includeDeleted: false,
      filter: { field: 'data.hh_id', op: 'eq', value: 'HH-42' },
    });
    expect('sql' in result).toBe(true);
    if (!('sql' in result)) return;
    expect(result.sql).not.toContain('form_type');
    expect(result.params).not.toContain('*');
  });

  it('omits the form_type predicate when formType is missing', () => {
    const result = compileObservationQuery({
      dialect: 'formulus',
      jsonColumn: 'data',
      tableAlias: 'observations',
      observationsTable: 'observations',
      indexKeys: new Set<string>(),
      includeDeleted: false,
    });
    expect('sql' in result).toBe(true);
    if (!('sql' in result)) return;
    expect(result.sql).not.toContain('form_type');
  });

  it('keeps the form_type predicate for a concrete form type', () => {
    const result = compileObservationQuery({
      dialect: 'formulus',
      jsonColumn: 'data',
      tableAlias: 'observations',
      observationsTable: 'observations',
      indexKeys: new Set<string>(),
      formType: 'household',
      includeDeleted: false,
    });
    expect('sql' in result).toBe(true);
    if (!('sql' in result)) return;
    expect(result.sql).toContain('form_type = ?');
    expect(result.params[0]).toBe('household');
  });
});

describe('ObservationQueryCompiler fixtures', () => {
  const fixtures = loadFixtures();

  it.each(fixtures.map((f) => [f.name, f] as const))('%s', (_name, fixture) => {
    const indexes: ObservationIndexDef[] = (fixture.indexKeys ?? []).map((key) => ({
      key,
      path: `$.${key}`,
    }));
    const indexKeys = indexKeysFromConfig(indexes);

    const dialect = fixture.jsonColumn === 'data' ? 'formulus' : 'desktop';
    const result = compileObservationQuery({
      dialect,
      jsonColumn: fixture.jsonColumn,
      indexKeys,
      formType: fixture.formType,
      includeDeleted: fixture.includeDeleted ?? false,
      filter: fixture.filter as never,
    });

    if (fixture.expectError) {
      expect('code' in result).toBe(true);
      if (fixture.expectedErrorCode && 'code' in result) {
        expect(result.code).toBe(fixture.expectedErrorCode);
      }
      return;
    }

    expect('sql' in result).toBe(true);
    if (!('sql' in result)) return;

    for (const fragment of expectedFragments(fixture, dialect)) {
      expect(result.sql).toContain(fragment);
    }

    if (fixture.expectWarning) {
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });
});
