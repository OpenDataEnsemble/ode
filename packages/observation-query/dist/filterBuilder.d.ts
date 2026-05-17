import type { ObservationCondition, ObservationField, ObservationFilter } from './types';
export declare function dataField(path: string): ObservationField;
export declare function dataEq(path: string, value: string | number): ObservationCondition;
export declare function dataIn(path: string, values: Array<string | number>): ObservationCondition;
export declare function andFilter(...conditions: ObservationFilter[]): ObservationFilter;
export declare function orFilter(...conditions: ObservationFilter[]): ObservationFilter;
/** Build AND filter from plain param map (keys are data paths without `data.` prefix). */
export declare function paramsToAndFilter(params: Record<string, unknown>): ObservationFilter | undefined;
/**
 * Parse legacy WHERE strings (data.field = 'value' AND ...) into a filter AST.
 * Skips age_from_dob(...) fragments (handled client-side in formplayer).
 */
export declare function parseLegacyWhereClause(where: string): ObservationFilter | undefined;
/** Merge static params and optional legacy where string into one filter. */
export declare function buildQueryFilter(params: Record<string, unknown>, whereClause?: string | null): ObservationFilter | undefined;
