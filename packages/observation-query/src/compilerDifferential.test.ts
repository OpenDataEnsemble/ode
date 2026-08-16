/**
 * The indexed path and the json_extract fallback must return the same rows.
 *
 * Callers drop to json_extract whenever a key is undeclared, and Formulus and
 * Desktop both drop to it wholesale when the index turns out to be unusable.
 * That safety net is only worth having if the two paths agree: a fallback that
 * quietly returns a different result set is worse than one that fails loudly.
 *
 * SQLite makes agreement easy to get wrong, because it orders values by storage
 * class instead of coercing them. `18 >= '18'` is false, so a numeric-looking
 * string operand used to match nothing on the fallback while matching on the
 * index; and `'abc' > 5` is true, so every text value used to match a numeric
 * filter on the fallback while matching none on the index.
 *
 * Each case below runs twice against the same database — once with the key
 * declared (indexed EXISTS) and once undeclared (json_extract) — and the two
 * result sets have to be identical.
 */
import * as path from 'path';
import initSqlJs, { type Database } from 'sql.js';
import { compileObservationQuery } from './compiler';
import type { ObservationFilter } from './types';

/**
 * Mirrors `ObservationIndexService.scalarToColumns` in Formulus and the Rust
 * indexer in Desktop: JSON numbers go to `value_num`, other scalars to
 * `value_text`, and absent, null and non-scalar values are not indexed at all.
 */
function indexColumns(value: unknown): {
  valueText: string | null;
  valueNum: number | null;
} | null {
  if (value == null) return null;
  if (typeof value === 'number') return { valueText: null, valueNum: value };
  if (typeof value === 'string') return { valueText: value, valueNum: null };
  if (typeof value === 'boolean')
    return { valueText: String(value), valueNum: null };
  return null;
}

const INDEX_KEYS = ['age', 'name'];

const OBSERVATIONS: Array<{ id: string; data: Record<string, unknown> }> = [
  { id: 'p01', data: { age: 18, name: 'ann' } },
  { id: 'p02', data: { age: 20, name: 'bob' } },
  { id: 'p03', data: { age: 5, name: 'cid' } },
  { id: 'p04', data: { age: '18', name: 'dee' } }, // numeric string
  { id: 'p05', data: { age: 'abc', name: 'eve' } }, // text sorts above numbers
  { id: 'p06', data: { name: 'fay' } }, // key absent
  { id: 'p07', data: { age: null, name: 'gil' } }, // explicit null
  { id: 'p08', data: { age: 18.5, name: 'hal' } }, // real
  { id: 'p09', data: { age: true, name: 'ivy' } }, // extracts as integer 1
  { id: 'p10', data: { age: [1, 2], name: 'jan' } }, // non-scalar
];

async function buildDatabase(): Promise<Database> {
  const SQL = await initSqlJs({
    locateFile: file => path.join(path.dirname(require.resolve('sql.js')), file),
  });
  const db = new SQL.Database();

  db.run(`
    CREATE TABLE observations (
      id TEXT PRIMARY KEY NOT NULL,
      observation_id TEXT NOT NULL,
      form_type TEXT NOT NULL,
      data TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE observation_index (
      observation_id TEXT NOT NULL,
      index_key TEXT NOT NULL,
      index_generation INTEGER NOT NULL,
      value_text TEXT,
      value_num REAL
    );
    CREATE TABLE observation_index_meta (
      id TEXT PRIMARY KEY NOT NULL,
      active_generation INTEGER NOT NULL
    );
    INSERT INTO observation_index_meta(id, active_generation) VALUES ('meta', 1);
  `);

  for (const obs of OBSERVATIONS) {
    db.run(
      'INSERT INTO observations(id, observation_id, form_type, data, deleted) VALUES (?, ?, ?, ?, 0)',
      [obs.id, obs.id, 'person', JSON.stringify(obs.data)],
    );
    for (const key of INDEX_KEYS) {
      const columns = indexColumns(obs.data[key]);
      if (!columns) continue;
      db.run(
        `INSERT INTO observation_index
           (observation_id, index_key, index_generation, value_text, value_num)
         VALUES (?, ?, 1, ?, ?)`,
        [obs.id, key, columns.valueText, columns.valueNum],
      );
    }
  }

  return db;
}

function run(
  db: Database,
  filter: ObservationFilter,
  declaredKeys: string[],
): string[] {
  const compiled = compileObservationQuery({
    dialect: 'formulus',
    jsonColumn: 'data',
    tableAlias: 'observations',
    observationsTable: 'observations',
    formType: 'person',
    includeDeleted: false,
    indexKeys: new Set(declaredKeys),
    filter,
  });
  if ('code' in compiled) {
    throw new Error(`${compiled.code}: ${compiled.message}`);
  }

  const statement = db.prepare(compiled.sql);
  statement.bind(compiled.params as (string | number | null)[]);
  const ids: string[] = [];
  while (statement.step()) {
    ids.push(statement.getAsObject().id as string);
  }
  statement.free();
  return ids.sort();
}

describe('indexed and json_extract paths agree', () => {
  let db: Database;

  beforeAll(async () => {
    db = await buildDatabase();
  });

  afterAll(() => {
    db?.close();
  });

  const cases: Array<[string, ObservationFilter]> = [
    ['eq on a string', { field: 'data.name', op: 'eq', value: 'bob' }],
    ['eq on a number', { field: 'data.age', op: 'eq', value: 18 }],
    ['eq on a numeric string', { field: 'data.age', op: 'eq', value: '18' }],
    ['gte with a number operand', { field: 'data.age', op: 'gte', value: 18 }],
    [
      'gte with a numeric string operand',
      { field: 'data.age', op: 'gte', value: '18' },
    ],
    ['gt with a number operand', { field: 'data.age', op: 'gt', value: 5 }],
    ['gt with a low bound', { field: 'data.age', op: 'gt', value: 0 }],
    ['lt with a number operand', { field: 'data.age', op: 'lt', value: 19 }],
    ['lte with a numeric string', { field: 'data.age', op: 'lte', value: '18' }],
    ['neq with a number operand', { field: 'data.age', op: 'neq', value: 18 }],
    [
      'neq with a numeric string operand',
      { field: 'data.age', op: 'neq', value: '18' },
    ],
    ['in with numbers', { field: 'data.age', op: 'in', value: [18, 20] }],
    ['in with strings', { field: 'data.age', op: 'in', value: ['18', 'abc'] }],
    [
      'and across two fields',
      {
        op: 'and',
        conditions: [
          { field: 'data.age', op: 'gte', value: '18' },
          { field: 'data.name', op: 'neq', value: 'hal' },
        ],
      },
    ],
    [
      'or across two fields',
      {
        op: 'or',
        conditions: [
          { field: 'data.age', op: 'lt', value: 10 },
          { field: 'data.name', op: 'eq', value: 'bob' },
        ],
      },
    ],
  ];

  it.each(cases)('%s', (_name, filter) => {
    expect(run(db, filter, INDEX_KEYS)).toEqual(run(db, filter, []));
  });

  it('matches numbers when the operand arrives as a string', () => {
    // The regression that motivated the guard: an age range typed into a
    // whereClause reaches the compiler as a string, and the fallback used to
    // return nothing at all for it.
    const filter: ObservationFilter = {
      field: 'data.age',
      op: 'gte',
      value: '18',
    };
    expect(run(db, filter, [])).toEqual(['p01', 'p02', 'p08']);
  });

  it('does not let text values satisfy a numeric comparison', () => {
    // 'abc' > 5 is true in SQLite, so p05 would match without the type guard.
    const filter: ObservationFilter = { field: 'data.age', op: 'gt', value: 5 };
    expect(run(db, filter, [])).not.toContain('p05');
  });

  it('does not let booleans satisfy a numeric comparison', () => {
    // JSON true extracts as the integer 1, so p09 would match `gt 0` under a
    // typeof() guard; json_type() reports it as 'true' and excludes it.
    const filter: ObservationFilter = { field: 'data.age', op: 'gt', value: 0 };
    expect(run(db, filter, [])).not.toContain('p09');
  });
});
