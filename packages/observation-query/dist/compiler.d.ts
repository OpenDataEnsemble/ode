import type { CompiledQuery, ObservationFilter, ObservationIndexDef, QueryCompileError } from './types';
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
export declare function compileFilter(filter: ObservationFilter, options: CompileOptions, warnings?: string[]): {
    sql: string;
    params: Array<string | number | null>;
} | QueryCompileError;
export declare function compileObservationQuery(options: CompileOptions & {
    filter?: ObservationFilter;
}): CompiledQuery | QueryCompileError;
export declare function indexKeysFromConfig(indexes: ObservationIndexDef[]): Set<string>;
