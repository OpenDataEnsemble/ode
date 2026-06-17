/**
 * Runs the same golden fixtures as packages/observation-query against the Formulus dialect.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  compileObservationQuery,
  indexKeysFromConfig,
  type ObservationIndexDef,
} from '@ode/observation-query';

const fixturesDir = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'packages',
  'observation-query',
  'fixtures',
);

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
  expectWarning?: boolean;
};

function expectedFragments(
  fixture: FixtureFile,
  dialect: 'formulus',
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
    .filter(f => f.endsWith('.json'))
    .map(
      f =>
        JSON.parse(
          fs.readFileSync(path.join(fixturesDir, f), 'utf8'),
        ) as FixtureFile,
    );
}

describe('Formulus observation query compiler (golden fixtures)', () => {
  const fixtures = loadFixtures();

  it.each(fixtures.map(f => [f.name, f] as const))('%s', (_name, fixture) => {
    const indexes: ObservationIndexDef[] = (fixture.indexKeys ?? []).map(
      key => ({ key, path: `$.${key}` }),
    );
    const result = compileObservationQuery({
      dialect: 'formulus',
      jsonColumn: 'data',
      tableAlias: 'observations',
      observationsTable: 'observations',
      indexKeys: indexKeysFromConfig(indexes),
      formType: fixture.formType,
      includeDeleted: fixture.includeDeleted ?? false,
      filter: fixture.filter as never,
    });

    if (fixture.expectError) {
      expect('code' in result).toBe(true);
      return;
    }

    expect('sql' in result).toBe(true);
    if (!('sql' in result)) return;

    for (const fragment of expectedFragments(fixture, 'formulus')) {
      expect(result.sql).toContain(fragment);
    }

    if (fixture.jsonColumn === 'data') {
      expect(result.sql).toContain('observations.deleted = 0');
    }

    if (fixture.expectWarning) {
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });
});
