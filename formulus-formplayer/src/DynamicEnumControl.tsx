/**
 * DynamicEnumControl.tsx
 *
 * Custom JSON Forms renderer for dynamic choice lists.
 * Supports x-dynamicEnum schema property to populate enum/oneOf values
 * from database queries at runtime.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { ControlProps, rankWith } from '@jsonforms/core';
import { useFormEvaluation } from './FormEvaluationContext';
import { useJsonForms } from '@jsonforms/react';
import {
  Autocomplete,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';

/**
 * Interface for x-dynamicEnum configuration
 */
interface DynamicEnumConfig {
  function: string; // Function name (e.g., "getDynamicChoiceList")
  query: string; // Query name or form type to query
  params?: Record<string, any>; // Query parameters (can include {{data.field}} templates)
  valueField?: string; // Field path for value (default: "observationId")
  labelField?: string; // Field path for label (default: "data.name" or similar)
  distinct?: boolean; // Whether to return distinct values only
}

/**
 * Helper to resolve the actual field schema from a scope path
 * Example: scope="#/properties/test_village" -> schema.properties.test_village
 */
function resolveSchemaFromScope(
  scope: string | undefined,
  rootSchema: any,
): any {
  if (!scope || !rootSchema) return rootSchema;

  // Parse scope like "#/properties/field_name" or "#/properties/nested/properties/field"
  const parts = scope.split('/').filter(p => p && p !== '#');

  let resolved = rootSchema;
  for (const part of parts) {
    if (resolved && typeof resolved === 'object') {
      resolved = resolved[part];
    } else {
      return rootSchema; // Fallback to root if path invalid
    }
  }

  return resolved || rootSchema;
}

/**
 * Tester function - determines when this renderer should be used
 */
export const dynamicEnumTester = rankWith(
  100, // High priority for x-dynamicEnum fields
  (uischema: any, schema: any, _context: any) => {
    // Resolve the actual field schema from the scope
    const fieldSchema = resolveSchemaFromScope(uischema?.scope, schema);
    return !!(fieldSchema as any)?.['x-dynamicEnum'];
  },
);

/**
 * Resolve template variables in params using form data
 * Supports {{data.field}} syntax (leveraging PR 259 handlebars support)
 */
function resolveTemplateParams(
  params: Record<string, any>,
  formData: Record<string, any>,
): Record<string, any> {
  const resolved: Record<string, any> = {};

  for (const [key, value] of Object.entries(params)) {
    if (
      typeof value === 'string' &&
      value.startsWith('{{') &&
      value.endsWith('}}')
    ) {
      // Extract path: {{data.village}} -> data.village
      const path = value.slice(2, -2).trim();

      // Remove "data." prefix if present (form data is already the data object)
      const dataPath = path.startsWith('data.') ? path.slice(5) : path;

      // Get nested value
      const pathParts = dataPath.split('.');
      let resolvedValue: any = formData;
      for (const part of pathParts) {
        if (resolvedValue && typeof resolvedValue === 'object') {
          resolvedValue = resolvedValue[part];
        } else {
          resolvedValue = undefined;
          break;
        }
      }
      // Use undefined when unresolved so getDynamicChoiceList returns [] (no options until dependency selected)
      resolved[key] = resolvedValue !== undefined ? resolvedValue : undefined;
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}

/**
 * Dynamic Enum Control Renderer
 */
const DynamicEnumControl: React.FC<ControlProps> = ({
  data,
  handleChange,
  path,
  errors,
  schema,
  uischema,
  enabled = true,
  visible = true,
}) => {
  const { functions } = useFormEvaluation();
  const ctx = useJsonForms();

  const [choices, setChoices] = useState<Array<{ const: any; title: string }>>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localSchema, setLocalSchema] = useState(schema);

  // Get x-dynamicEnum configuration first
  const dynamicConfig = useMemo(() => {
    return (schema as any)?.['x-dynamicEnum'] as DynamicEnumConfig | undefined;
  }, [schema]);

  // Get current form data for template parameter resolution
  const currentFormData = ctx?.core?.data || {};

  // Handle value change - must be defined before any early returns
  const handleValueChange = useCallback(
    (_event: any, newValue: { const: any; title: string } | null) => {
      handleChange(path, newValue ? newValue.const : '');
    },
    [handleChange, path],
  );

  // Find selected option based on current data value - must be before early returns
  const selectedOption = useMemo(() => {
    return choices.find(opt => opt.const === data) || null;
  }, [choices, data]);

  // Get display label from schema or uischema - computed before early returns
  const label = useMemo(() => {
    return (
      (uischema as any)?.label ||
      schema.title ||
      path.split('.').pop() ||
      'Field'
    );
  }, [uischema, schema, path]);

  const description = schema.description;
  const hasValidationErrors = errors && errors.length > 0;

  // Load choices when component mounts or params change
  const loadChoices = useCallback(async () => {
    if (!dynamicConfig) {
      setError('x-dynamicEnum configuration is missing');
      return;
    }

    // Validate configuration
    if (!dynamicConfig.query) {
      setError('x-dynamicEnum: query is required');
      return;
    }

    const functionName = dynamicConfig.function || 'getDynamicChoiceList';
    const func = functions.get(functionName);

    if (!func) {
      const availableFunctions = Array.from(functions.keys()).join(', ');
      setError(
        `Function "${functionName}" not found. Available: ${availableFunctions || 'none'}.`,
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Resolve template parameters (if any - they will be ignored if unresolved)
      const resolvedParams = dynamicConfig.params
        ? resolveTemplateParams(
            dynamicConfig.params,
            currentFormData as Record<string, any>,
          )
        : {};

      // Add configuration for valueField, labelField, and distinct
      const paramsWithConfig = {
        ...resolvedParams,
        _config: {
          valueField: dynamicConfig.valueField || 'observationId',
          labelField: dynamicConfig.labelField || 'data.name',
          distinct: dynamicConfig.distinct || false,
          distinctField: dynamicConfig.labelField || 'data.name',
        },
      };

      // Call the function with correct signature: (queryName, params, formData)
      const result = await func(
        dynamicConfig.query,
        paramsWithConfig,
        currentFormData,
      );

      if (!Array.isArray(result)) {
        throw new Error(`Function returned ${typeof result}, expected array`);
      }

      setChoices(result);

      // Update local schema with dynamic enum
      const updatedSchema = {
        ...localSchema,
        enum: result.map(item => item.const),
      };
      setLocalSchema(updatedSchema);
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to load dynamic choices';
      setError(`${errorMessage}`);
      console.error(`Error loading dynamic choices for ${path}:`, err);
    } finally {
      setLoading(false);
    }
  }, [dynamicConfig, functions, path, localSchema, currentFormData]); // Use currentFormData instead

  // Load choices on mount, when config changes, and when form data changes (for cascading filters)
  // currentFormData must be in deps so fields that use {{data.field}} templates reload
  // when the user selects a value in a dependent field (e.g. sex -> filter person list)
  useEffect(() => {
    if (dynamicConfig && visible && enabled) {
      loadChoices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dynamicConfig?.query,
    JSON.stringify(dynamicConfig?.params),
    visible,
    enabled,
    JSON.stringify(currentFormData),
  ]);

  // Early returns after all hooks
  if (!visible) {
    return null;
  }

  if (!dynamicConfig) {
    return (
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 500 }}>
          {label}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {description}
          </Typography>
        )}
        <Alert severity="error">x-dynamicEnum configuration is missing</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 2 }}>
      {/* Field Label */}
      <Typography variant="h6" sx={{ mb: 1, fontWeight: 500 }}>
        {label}
        {schema.required && <span style={{ color: 'red' }}> *</span>}
      </Typography>

      {/* Description */}
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {description}
        </Typography>
      )}

      {/* Validation Errors */}
      {hasValidationErrors && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {Array.isArray(errors) ? errors.join(', ') : String(errors)}
        </Alert>
      )}
      {/* Control */}
      {loading ? (
        <Box display="flex" alignItems="center" gap={2} sx={{ mt: 1 }}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">
            Loading choices...
          </Typography>
        </Box>
      ) : error ? (
        <Box sx={{ mt: 1 }}>
          <Alert severity="error" sx={{ mb: 1 }}>
            {error}
          </Alert>
          <Typography
            variant="body2"
            color="primary"
            sx={{ cursor: 'pointer', textDecoration: 'underline' }}
            onClick={loadChoices}>
            Retry
          </Typography>
        </Box>
      ) : choices.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          No options available
        </Typography>
      ) : (
        <Autocomplete
          value={selectedOption}
          onChange={handleValueChange}
          options={choices}
          getOptionLabel={option => option.title || String(option.const)}
          isOptionEqualToValue={(option, value) => option.const === value.const}
          disabled={!enabled}
          sx={{ mt: 1 }}
          renderInput={params => (
            <TextField
              {...params}
              error={!!hasValidationErrors}
              helperText={
                hasValidationErrors
                  ? Array.isArray(errors)
                    ? errors.join(', ')
                    : String(errors)
                  : ''
              }
              placeholder="Select an option..."
            />
          )}
        />
      )}
    </Box>
  );
};

export default withJsonFormsControlProps(DynamicEnumControl);
