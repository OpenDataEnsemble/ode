/** Top-level observation columns (not in JSON payload). */
export type ObservationMetaField =
  | 'observation_id'
  | 'form_type'
  | 'form_version'
  | 'deleted'
  | 'created_at'
  | 'updated_at'
  | 'author'
  | 'device_id';

export type ObservationField = ObservationMetaField | `data.${string}`;

export type ComparisonOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';

export type ObservationCondition = {
  field: ObservationField;
  op: ComparisonOp;
  value: string | number | boolean | null | Array<string | number>;
};

/** Explicit array quantifier compiled to EXISTS + json_each. */
export type ObservationQuantifier = {
  op: 'any';
  /** JSON array path, e.g. data.members */
  path: string;
  /** Iterator alias for member fields, e.g. m → m.id */
  as: string;
  where: ObservationCondition;
};

export type ObservationLogical = {
  op: 'and' | 'or';
  conditions: ObservationFilter[];
};

export type ObservationFilter =
  | ObservationCondition
  | ObservationQuantifier
  | ObservationLogical;

export type ObservationIndexDef = {
  key: string;
  path: string;
  valueType?: 'string' | 'number';
  formTypes?: string[];
  enableExpressionIndex?: boolean;
};

export type GetObservationsByQueryOptions = {
  formType: string;
  includeDeleted?: boolean;
  filter?: ObservationFilter;
  orderBy?: { field: 'created_at' | 'updated_at'; direction: 'asc' | 'desc' };
  limit?: number;
};

export type CompiledQuery = {
  sql: string;
  params: Array<string | number | null>;
  warnings: string[];
};

export type QueryCompileError = {
  code: string;
  message: string;
};
