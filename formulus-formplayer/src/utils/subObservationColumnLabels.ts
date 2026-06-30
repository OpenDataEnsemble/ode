import type { UISchemaElement } from '@jsonforms/core';
import {
  buildControlIndexByFieldKey,
  type LinkedFormSpecsMap,
  resolveFieldLabel,
} from './controlDisplayText';
import type { ColumnSpec } from '../renderers/subObservationHelpers';

export type ColumnDef = { key: string; label?: string };

function mergeColumnDefsByKey(
  schemaColumns: ColumnDef[] | undefined,
  uiColumns: ColumnDef[] | undefined,
): ColumnDef[] {
  const base = Array.isArray(schemaColumns) ? schemaColumns : [];
  const patch = Array.isArray(uiColumns) ? uiColumns : [];
  if (patch.length === 0) {
    return base.map(c => ({ ...c }));
  }
  const result = base.map(c => ({ ...c }));
  for (const patchCol of patch) {
    if (!patchCol?.key) continue;
    const idx = result.findIndex(c => c.key === patchCol.key);
    if (idx >= 0) {
      result[idx] = { ...result[idx], ...patchCol };
    } else {
      result.push({ ...patchCol });
    }
  }
  return result;
}

/**
 * Resolve sub-observation table column headers.
 * - Explicit column.label → static override (all locales).
 * - Otherwise → linked child form field label via resolveFieldLabel.
 */
export function resolveSubObservationColumns(
  columnDefs: ColumnDef[],
  linkedForm: string,
  linkedFormSpecs: LinkedFormSpecsMap | undefined,
): ColumnSpec[] {
  const spec = linkedFormSpecs?.[linkedForm];
  const childSchema = spec?.schema;
  const childUi = spec?.uiSchema;
  const childIndex =
    childUi !== undefined ? buildControlIndexByFieldKey(childUi) : undefined;

  return columnDefs.map(col => {
    const staticLabel =
      typeof col.label === 'string' && col.label.trim().length > 0
        ? col.label.trim()
        : null;
    if (staticLabel) {
      return { key: col.key, label: staticLabel };
    }
    if (childSchema && childIndex) {
      return {
        key: col.key,
        label: resolveFieldLabel(childSchema, childUi, col.key, childIndex),
      };
    }
    return { key: col.key, label: col.key };
  });
}

export function mergeSubObservationColumnDefs(
  schemaColumns: ColumnDef[] | undefined,
  uischema: UISchemaElement | undefined,
): ColumnDef[] {
  const uiCols = (
    uischema as { options?: { columns?: ColumnDef[] } } | undefined
  )?.options?.columns;
  return mergeColumnDefsByKey(schemaColumns, uiCols);
}
