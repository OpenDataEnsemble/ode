/**
 * Sub-observation — embedded repeats on a parent form (`format: "sub-observation"`).
 * Each embedded payload is plain JSON on the parent observation; nested forms open via
 * `openFormplayer` with `subObservationMode`.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { withJsonFormsControlProps, useJsonForms } from '@jsonforms/react';
import { ControlProps, rankWith, schemaMatches } from '@jsonforms/core';
import { Box, Typography, Button, IconButton, Tooltip } from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import QuestionShell from '../components/QuestionShell';
import FormulusClient from '../services/FormulusInterface';
import type { FormCompletionResult } from '../types/FormulusInterfaceDefinition';
import { tokens } from '../theme/tokens-adapter';
import {
  buildColumns,
  coerceSubObservationRows,
  optionalRecordMap,
  readSubObservationField,
  sortRows,
  readDataPath,
  resolveItemLabel,
  resolveAddButtonLabel,
  resolveEmptyLabel,
  resolveDeleteFallbackLabel,
  buildSubObservationOpenParams,
  type OrderBySpec,
} from './subObservationHelpers';

const RESERVED_SCHEMA_KEYS = new Set([
  'type',
  'title',
  'description',
  'format',
  'enum',
  'const',
  'default',
  'required',
  'properties',
  'items',
  'oneOf',
  'anyOf',
  'allOf',
  '$ref',
  '$schema',
  'additionalProperties',
  'pattern',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'minItems',
  'maxItems',
]);

/** Above custom question-type rank (6); below specialized overrides if needed. */
export const subObservationQuestionTester = rankWith(
  10,
  schemaMatches(schema => {
    const s = schema as Record<string, unknown>;
    return s?.format === 'sub-observation';
  }),
);

function extractConfig(
  schema: ControlProps['schema'],
): Record<string, unknown> {
  const schemaObj = schema as Record<string, unknown>;
  const config: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schemaObj)) {
    if (!RESERVED_SCHEMA_KEYS.has(key) && !key.startsWith('$')) {
      config[key] = value;
    }
  }
  return config;
}

function resolveParentValue(
  formData: Record<string, unknown>,
  parentValuePath: string | undefined,
): string | null {
  if (parentValuePath) {
    const fromPath = readDataPath(formData, parentValuePath);
    if (fromPath != null && fromPath !== '') return String(fromPath);
  }
  const oid = formData.observationId;
  if (oid != null && oid !== '') return String(oid);
  return null;
}

function isObservationWrappedRow(row: Record<string, unknown>): boolean {
  return (
    row.isLocal === true ||
    row.isDraft === true ||
    typeof row.observationId === 'string'
  );
}

const SubObservationQuestionRendererInner: React.FC<ControlProps> = ({
  data,
  handleChange,
  path,
  errors,
  schema,
  uischema,
  enabled = true,
  visible = true,
  label,
  description,
  required,
}) => {
  const jsonForms = useJsonForms();
  const config = useMemo(() => extractConfig(schema), [schema]);

  const childFormType =
    typeof config.linkedForm === 'string' ? config.linkedForm : '';
  const parentKey =
    typeof config.parentKey === 'string' ? config.parentKey : undefined;
  const allowDelete = config.allowDelete !== false;
  const parentValuePath =
    typeof config.parentValuePath === 'string'
      ? config.parentValuePath
      : undefined;

  const missingKeys = useMemo(() => {
    const m: string[] = [];
    if (!childFormType) m.push('linkedForm');
    return m;
  }, [childFormType]);

  const formData = useMemo((): Record<string, unknown> => {
    const d = jsonForms.core?.data;
    return d && typeof d === 'object' ? (d as Record<string, unknown>) : {};
  }, [jsonForms.core?.data]);

  const valueRows = useMemo(() => coerceSubObservationRows(data), [data]);

  const configError = useMemo(
    () =>
      missingKeys.length > 0
        ? `Missing sub-observation config: ${missingKeys.join(', ')}`
        : null,
    [missingKeys],
  );

  const sortedFromProps = useMemo(
    () =>
      missingKeys.length > 0
        ? []
        : sortRows(valueRows, config.orderBy as OrderBySpec),
    [valueRows, missingKeys, config.orderBy],
  );

  // JsonForms `data` is the source of truth; pushSorted writes via handleChange only.
  const rows = sortedFromProps;

  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const getCurrentRows = useCallback((): Record<string, unknown>[] => {
    const root = jsonForms.core?.data;
    const raw =
      root && typeof root === 'object' && path
        ? readDataPath(root as Record<string, unknown>, path)
        : data;
    return sortRows(
      coerceSubObservationRows(raw),
      config.orderBy as OrderBySpec,
    ) as Record<string, unknown>[];
  }, [jsonForms.core?.data, data, path, config.orderBy]);

  const columns = useMemo(() => buildColumns(config, rows), [config, rows]);

  const itemLabel = useMemo(() => resolveItemLabel(config), [config]);

  const addButtonLabelOverride = useMemo(() => {
    const opts = (uischema as { options?: { addButtonLabel?: unknown } })
      ?.options;
    return opts?.addButtonLabel;
  }, [uischema]);

  const addButtonText = useMemo(
    () =>
      resolveAddButtonLabel({
        itemLabel,
        addButtonLabel: addButtonLabelOverride,
        busy: busyId === 'add',
      }),
    [itemLabel, addButtonLabelOverride, busyId],
  );

  const emptyLabel = useMemo(() => resolveEmptyLabel(itemLabel), [itemLabel]);

  const deleteFallbackLabel = useMemo(
    () => resolveDeleteFallbackLabel(itemLabel),
    [itemLabel],
  );

  const requestFormRevalidation = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('formRevalidate'));
      }, 0);
    }
  }, []);

  const pushSorted = useCallback(
    (next: Record<string, unknown>[]) => {
      const sorted = sortRows(next, config.orderBy as OrderBySpec);
      handleChange(path, sorted);
      requestFormRevalidation();
    },
    [config.orderBy, handleChange, path, requestFormRevalidation],
  );

  const handleAdd = useCallback(async () => {
    if (!enabled || missingKeys.length || !childFormType) return;
    const client = FormulusClient.getInstance();
    try {
      setBusyId('add');
      const pv = resolveParentValue(formData, parentValuePath);
      const openParams = buildSubObservationOpenParams(
        formData,
        config,
        pv,
        optionalRecordMap(config.subObservationInitValues),
      );
      if (parentKey && pv != null && openParams[parentKey] == null) {
        openParams[parentKey] = pv;
      }
      const result: FormCompletionResult = await client.openFormplayer(
        childFormType,
        openParams,
        {},
        {
          subObservationMode: true,
          skipFinalize: Boolean(config.skipFinalize),
        },
      );
      if (result?.status === 'form_submitted' && result.formData) {
        const row = result.formData as Record<string, unknown>;
        pushSorted([...getCurrentRows(), row]);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Unable to add sub-observation',
      );
    } finally {
      setBusyId(null);
    }
  }, [
    enabled,
    missingKeys,
    childFormType,
    formData,
    parentValuePath,
    parentKey,
    config,
    getCurrentRows,
    pushSorted,
  ]);

  const handleEdit = useCallback(
    async (row: Record<string, unknown>, index: number) => {
      if (!enabled || !childFormType || missingKeys.length) return;
      const client = FormulusClient.getInstance();
      try {
        setBusyId(`edit_${index}`);
        const pv = resolveParentValue(formData, parentValuePath);
        const openParams = buildSubObservationOpenParams(
          formData,
          config,
          pv,
          optionalRecordMap(config.subObservationEditInitValues),
        );
        const { context: _ctx, ...paramDefaults } = openParams;
        const rowData = isObservationWrappedRow(row)
          ? ((row.data ?? {}) as Record<string, unknown>)
          : row;
        const savedData: Record<string, unknown> = {
          ...rowData,
          ...paramDefaults,
        };
        const result: FormCompletionResult = await client.openFormplayer(
          childFormType,
          openParams,
          savedData,
          {
            subObservationMode: true,
            skipFinalize: Boolean(config.skipFinalize),
          },
        );
        if (
          result &&
          (result.status === 'form_submitted' ||
            result.status === 'form_updated') &&
          result.formData
        ) {
          const updated = getCurrentRows().map((r, i) =>
            i === index ? (result.formData as Record<string, unknown>) : r,
          );
          pushSorted(updated);
        }
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Unable to edit sub-observation',
        );
      } finally {
        setBusyId(null);
      }
    },
    [
      enabled,
      childFormType,
      missingKeys,
      formData,
      parentValuePath,
      config,
      getCurrentRows,
      pushSorted,
    ],
  );

  const handleDelete = useCallback(
    (row: Record<string, unknown>, index: number) => {
      if (!enabled || !allowDelete) return;
      const rowData = isObservationWrappedRow(row)
        ? ((row.data ?? {}) as Record<string, unknown>)
        : row;
      const df =
        typeof config.displayField === 'string'
          ? config.displayField
          : undefined;
      const v = df ? readDataPath(rowData, df) : undefined;
      const rowTitle = v != null && v !== '' ? String(v) : deleteFallbackLabel;
      if (
        typeof window !== 'undefined' &&
        !window.confirm(`Delete "${rowTitle}"?`)
      ) {
        return;
      }
      try {
        pushSorted(getCurrentRows().filter((_, i) => i !== index));
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Unable to delete sub-observation',
        );
      }
    },
    [
      enabled,
      allowDelete,
      config.displayField,
      getCurrentRows,
      pushSorted,
      deleteFallbackLabel,
    ],
  );

  if (!visible) return null;

  const shellError =
    errors &&
    (Array.isArray(errors)
      ? errors.map((x: { message?: string }) => x.message ?? '').join(', ')
      : String(errors));

  return (
    <QuestionShell
      block
      title={label ?? ''}
      description={description}
      required={required}
      error={shellError}>
      <Box sx={{ width: '100%', mb: 2 }}>
        <Box sx={{ mb: 1.5, display: 'flex', justifyContent: 'flex-start' }}>
          <Button
            variant="outlined"
            size="small"
            disabled={
              !enabled ||
              busyId === 'add' ||
              !childFormType ||
              missingKeys.length > 0
            }
            onClick={() => void handleAdd()}>
            {addButtonText}
          </Button>
        </Box>

        <Box
          sx={{
            border: `${tokens.border.width.thin} solid`,
            borderColor: 'divider',
            borderRadius: tokens.border.radius.md,
            overflow: 'hidden',
            backgroundColor: 'background.paper',
          }}>
          <Box
            component="table"
            sx={{ width: '100%', borderCollapse: 'collapse' }}>
            <Box component="thead">
              <Box component="tr">
                {columns.map(col => (
                  <Box
                    component="th"
                    key={col.key}
                    sx={{
                      textAlign: 'left',
                      px: 1.5,
                      py: 1.25,
                      backgroundColor: 'action.hover',
                      borderBottom: `${tokens.border.width.thin} solid`,
                      borderColor: 'divider',
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                    }}>
                    {col.label}
                  </Box>
                ))}
                <Box
                  component="th"
                  sx={{
                    textAlign: 'left',
                    px: 1.5,
                    py: 1.25,
                    backgroundColor: 'action.hover',
                    borderBottom: `${tokens.border.width.thin} solid`,
                    borderColor: 'divider',
                    width: 140,
                  }}>
                  Actions
                </Box>
              </Box>
            </Box>
            <Box component="tbody">
              {rows.length === 0 ? (
                <Box component="tr">
                  <Box
                    component="td"
                    colSpan={columns.length + 1}
                    sx={{
                      py: 1.25,
                      px: 1.5,
                      color: 'text.secondary',
                      borderBottom: `${tokens.border.width.thin} solid`,
                      borderColor: 'divider',
                      verticalAlign: 'middle',
                      fontSize: '0.875rem',
                    }}>
                    {emptyLabel}
                  </Box>
                </Box>
              ) : (
                rows.map((row, index) => {
                  const rowKey =
                    typeof row.observationId === 'string'
                      ? row.observationId
                      : `row_${index}`;
                  const rowBusy = busyId === `edit_${index}`;
                  return (
                    <Box component="tr" key={rowKey}>
                      {columns.map(col => (
                        <Box
                          component="td"
                          key={col.key}
                          sx={{
                            borderBottom: `${tokens.border.width.thin} solid`,
                            borderColor: 'divider',
                            py: 1.25,
                            px: 1.5,
                            verticalAlign: 'middle',
                            fontSize: '0.875rem',
                          }}>
                          {readSubObservationField(row, col.key)}
                        </Box>
                      ))}
                      <Box
                        component="td"
                        sx={{
                          borderBottom: `${tokens.border.width.thin} solid`,
                          borderColor: 'divider',
                          py: 1.25,
                          px: 1.5,
                          verticalAlign: 'middle',
                        }}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Tooltip title="Edit">
                            <span>
                              <IconButton
                                size="small"
                                disabled={!enabled || rowBusy}
                                aria-label="Edit"
                                onClick={() => void handleEdit(row, index)}>
                                <EditOutlinedIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          {allowDelete && (
                            <Tooltip title="Delete">
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={!enabled || rowBusy}
                                  aria-label="Delete"
                                  onClick={() => handleDelete(row, index)}>
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  );
                })
              )}
            </Box>
          </Box>
        </Box>

        {(configError ?? error) && (
          <Typography
            variant="caption"
            color="error"
            sx={{ mt: 1, display: 'block' }}>
            {configError ?? error}
          </Typography>
        )}
      </Box>
    </QuestionShell>
  );
};

export const SubObservationQuestionRenderer = withJsonFormsControlProps(
  SubObservationQuestionRendererInner,
);

export default SubObservationQuestionRenderer;
