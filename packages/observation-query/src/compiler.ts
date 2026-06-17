import type {
  CompiledQuery,
  ObservationCondition,
  ObservationFilter,
  ObservationIndexDef,
  QueryCompileError,
} from './types';

export type CompileOptions = {
  /** observations table alias */
  tableAlias?: string;
  /** Storage backend SQL conventions */
  dialect?: 'formulus' | 'desktop';
  /** JSON column name: data (Formulus) or payload (Desktop) */
  jsonColumn: 'data' | 'payload';
  /** Declared index keys from app.config */
  indexKeys: Set<string>;
  /** observations vs observation_index table names */
  observationsTable?: string;
  indexTable?: string;
  formType?: string;
  includeDeleted?: boolean;
};

const META_COLUMNS = new Set([
  'observation_id',
  'form_type',
  'form_version',
  'deleted',
  'created_at',
  'updated_at',
  'author',
  'device_id',
]);

function metaColumnSql(
  field: string,
  alias: string,
  dialect: 'formulus' | 'desktop',
): string {
  if (field === 'observation_id') {
    return dialect === 'formulus' ? `${alias}.observation_id` : `${alias}.id`;
  }
  if (field === 'deleted') {
    if (dialect === 'formulus') {
      return `${alias}.deleted`;
    }
    return `COALESCE(json_extract(${alias}.observation_extras, '$.deleted'), 0)`;
  }
  return `${alias}.${field}`;
}

function jsonPathFromDataField(field: string): string {
  const path = field.startsWith('data.') ? field.slice(5) : field;
  return `$.${path}`;
}

function pushParam(params: Array<string | number | null>, value: unknown): string {
  params.push(value as string | number | null);
  return '?';
}

export function compileFilter(
  filter: ObservationFilter,
  options: CompileOptions,
  warnings: string[] = []
): { sql: string; params: Array<string | number | null> } | QueryCompileError {
  const alias = options.tableAlias ?? 'o';
  const params: Array<string | number | null> = [];
  const result = compileNode(filter, options, alias, params, warnings);
  if (typeof result !== 'string') return result;
  return { sql: result, params };
}

function compileNode(
  filter: ObservationFilter,
  options: CompileOptions,
  alias: string,
  params: Array<string | number | null>,
  warnings: string[]
): string | QueryCompileError {
  if ('op' in filter && (filter.op === 'and' || filter.op === 'or')) {
    if (!filter.conditions?.length) {
      return { code: 'EMPTY_LOGICAL', message: 'Logical filter must have conditions' };
    }
    const parts: string[] = [];
    for (const c of filter.conditions) {
      const part = compileNode(c, options, alias, params, warnings);
      if (typeof part !== 'string') return part;
      parts.push(`(${part})`);
    }
    return parts.join(` ${filter.op.toUpperCase()} `);
  }

  if ('op' in filter && filter.op === 'any') {
    return compileQuantifier(filter, options, alias, params);
  }

  return compileCondition(filter as ObservationCondition, options, alias, params, warnings);
}

function compileQuantifier(
  q: { op: 'any'; path: string; as: string; where: ObservationCondition },
  options: CompileOptions,
  alias: string,
  params: Array<string | number | null>
): string | QueryCompileError {
  const jsonCol = options.jsonColumn;
  const arrayPath = q.path.startsWith('data.') ? q.path.slice(5) : q.path;
  const jsonPath = `$.${arrayPath}`;
  const memberField = q.where.field.startsWith(`${q.as}.`)
    ? q.where.field.slice(q.as.length + 1)
    : q.where.field.replace(/^data\./, '');

  if (q.where.op !== 'eq') {
    return { code: 'QUANTIFIER_OP', message: 'any() quantifier where supports eq only in v1' };
  }

  const p = pushParam(params, q.where.value);
  return `EXISTS (SELECT 1 FROM json_each(${alias}.${jsonCol}, '${jsonPath}') AS ${q.as} WHERE json_extract(${q.as}.value, '$.${memberField}') = ${p})`;
}

function compileCondition(
  cond: ObservationCondition,
  options: CompileOptions,
  alias: string,
  params: Array<string | number | null>,
  warnings: string[]
): string | QueryCompileError {
  const field = cond.field;

  if (META_COLUMNS.has(field)) {
    return compileMetaCondition(
      cond,
      alias,
      params,
      options.dialect ?? 'desktop',
    );
  }

  if (!field.startsWith('data.')) {
    return { code: 'INVALID_FIELD', message: `Unknown field: ${field}` };
  }

  const indexKey = field.slice(5);
  const useIndex = options.indexKeys.has(indexKey);
  const jsonCol = options.jsonColumn;
  const jsonPath = jsonPathFromDataField(field);

  if (!useIndex) {
    warnings.push(`Undeclared index for ${field}; using json_extract fallback`);
    return compileJsonExtractCondition(cond, jsonCol, jsonPath, params, alias);
  }

  const idxTable = options.indexTable ?? 'observation_index';
  const keyPh = pushParam(params, indexKey);
  const genClause = `idx.index_generation = COALESCE((SELECT active_generation FROM observation_index_meta WHERE id = 'meta'), 1)`;

  if (cond.op === 'in') {
    const values = Array.isArray(cond.value) ? cond.value : [];
    if (!values.length) return '0';
    const placeholders = values.map((v) => pushParam(params, v));
    const numOnly = values.every((v) => typeof v === 'number');
    if (numOnly) {
      return `EXISTS (SELECT 1 FROM ${idxTable} idx WHERE idx.observation_id = ${alias}.id AND idx.index_key = ${keyPh} AND ${genClause} AND idx.value_num IN (${placeholders.join(',')}))`;
    }
    return `EXISTS (SELECT 1 FROM ${idxTable} idx WHERE idx.observation_id = ${alias}.id AND idx.index_key = ${keyPh} AND ${genClause} AND idx.value_text IN (${placeholders.join(',')}))`;
  }

  const val = cond.value;
  const isNum =
    typeof val === 'number' ||
    (typeof val === 'string' && val !== '' && !Number.isNaN(Number(val)) && cond.op !== 'eq');

  if (isNum && ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'].includes(cond.op)) {
    const p = pushParam(params, Number(val));
    const opMap: Record<string, string> = {
      eq: '=',
      neq: '!=',
      gt: '>',
      gte: '>=',
      lt: '<',
      lte: '<=',
    };
    return `EXISTS (SELECT 1 FROM ${idxTable} idx WHERE idx.observation_id = ${alias}.id AND idx.index_key = ${keyPh} AND ${genClause} AND idx.value_num ${opMap[cond.op]} ${p})`;
  }

  const p = pushParam(params, val == null ? null : String(val));
  const opMap: Record<string, string> = { eq: '=', neq: '!=' };
  if (!(cond.op in opMap)) {
    return { code: 'UNSUPPORTED_OP', message: `Operator ${cond.op} not supported on indexed text field` };
  }
  return `EXISTS (SELECT 1 FROM ${idxTable} idx WHERE idx.observation_id = ${alias}.id AND idx.index_key = ${keyPh} AND ${genClause} AND idx.value_text ${opMap[cond.op]} ${p})`;
}

function compileMetaCondition(
  cond: ObservationCondition,
  alias: string,
  params: Array<string | number | null>,
  dialect: 'formulus' | 'desktop',
): string | QueryCompileError {
  const col = metaColumnSql(cond.field, alias, dialect);
  if (cond.op === 'in') {
    const values = Array.isArray(cond.value) ? cond.value : [];
    if (!values.length) return '0';
    const placeholders = values.map((v) => pushParam(params, v));
    return `${col} IN (${placeholders.join(',')})`;
  }
  const opMap: Record<string, string> = {
    eq: '=',
    neq: '!=',
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
  };
  if (!(cond.op in opMap)) {
    return { code: 'UNSUPPORTED_OP', message: `Unsupported op ${cond.op} on ${cond.field}` };
  }
  const p = pushParam(params, cond.value as string | number | null);
  return `${col} ${opMap[cond.op]} ${p}`;
}

function compileJsonExtractCondition(
  cond: ObservationCondition,
  jsonCol: string,
  jsonPath: string,
  params: Array<string | number | null>,
  tableAlias = 'o'
): string | QueryCompileError {
  const expr = `json_extract(${tableAlias}.${jsonCol}, '${jsonPath}')`;
  if (cond.op === 'in') {
    const values = Array.isArray(cond.value) ? cond.value : [];
    if (!values.length) return '0';
    const placeholders = values.map((v) => pushParam(params, v));
    return `${expr} IN (${placeholders.join(',')})`;
  }
  const opMap: Record<string, string> = {
    eq: '=',
    neq: '!=',
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
  };
  if (!(cond.op in opMap)) {
    return { code: 'UNSUPPORTED_OP', message: `Unsupported op ${cond.op}` };
  }
  const p = pushParam(params, cond.value as string | number | null);
  return `${expr} ${opMap[cond.op]} ${p}`;
}

export function compileObservationQuery(
  options: CompileOptions & { filter?: ObservationFilter }
): CompiledQuery | QueryCompileError {
  const alias = options.tableAlias ?? 'o';
  const dialect = options.dialect ?? 'desktop';
  const observationsTable = options.observationsTable ?? 'observations';
  const warnings: string[] = [];
  const whereParts: string[] = [];
  const params: Array<string | number | null> = [];

  const formType = options.formType;
  if (formType && formType !== '*') {
    whereParts.push(`${alias}.form_type = ?`);
    params.push(formType);
  }

  if (!options.includeDeleted) {
    if (dialect === 'formulus') {
      whereParts.push(`${alias}.deleted = 0`);
    } else {
      whereParts.push(
        `COALESCE(json_extract(${alias}.observation_extras, '$.deleted'), 0) = 0`,
      );
    }
  }

  if (options.filter) {
    const compiled = compileFilter(options.filter, options, warnings);
    if ('code' in compiled) return compiled;
    whereParts.push(compiled.sql);
    params.push(...compiled.params);
  }

  const whereClause =
    whereParts.length > 0 ? ` WHERE ${whereParts.join(' AND ')}` : '';
  const sql = `SELECT ${alias}.* FROM ${observationsTable} ${alias}${whereClause}`;
  return { sql, params, warnings };
}

export function indexKeysFromConfig(indexes: ObservationIndexDef[]): Set<string> {
  return new Set(indexes.map((i) => i.key));
}
