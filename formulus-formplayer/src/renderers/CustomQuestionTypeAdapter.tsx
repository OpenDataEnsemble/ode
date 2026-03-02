/**
 * CustomQuestionTypeAdapter.tsx
 *
 * Bridges JSON Forms ControlProps → CustomQuestionTypeProps.
 * Wraps every custom question type in QuestionShell + ErrorBoundary
 * so that form authors get consistent styling and crash isolation.
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { withJsonFormsControlProps, useJsonForms } from '@jsonforms/react';
import type { ControlProps } from '@jsonforms/core';
import QuestionShell from '../components/QuestionShell';
import type { CustomQuestionTypeProps } from '../types/CustomQuestionTypeContract';

// ---------------------------------------------------------------------------
// Error Boundary — catches crashes in custom components
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
  formatName: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class CustomQuestionErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(
      `[CustomQuestionType] "${this.props.formatName}" crashed:`,
      error,
      info.componentStack,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '16px',
            border: '1px solid #f44336',
            borderRadius: '4px',
            backgroundColor: '#ffebee',
            color: '#c62828',
            margin: '8px 0',
          }}>
          <strong style={{ display: 'block', marginBottom: '8px' }}>
            ⚠️ Custom Question Type Error
          </strong>
          <div style={{ fontSize: '0.9em', marginBottom: '8px' }}>
            The custom question type <code>"{this.props.formatName}"</code>{' '}
            encountered an error and could not be rendered.
          </div>
          <details style={{ fontSize: '0.85em', marginTop: '8px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              Error Details (click to expand)
            </summary>
            <pre
              style={{
                marginTop: '8px',
                padding: '8px',
                backgroundColor: '#fff',
                borderRadius: '4px',
                overflow: 'auto',
                fontSize: '0.8em',
              }}>
              {this.state.error?.message || 'Unknown error'}
              {this.state.error?.stack && (
                <>
                  {'\n\n'}
                  {this.state.error.stack}
                </>
              )}
            </pre>
          </details>
          <div
            style={{
              fontSize: '0.85em',
              marginTop: '8px',
              fontStyle: 'italic',
            }}>
            The form will continue to function, but this field cannot be edited.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Adapter — maps ControlProps → CustomQuestionTypeProps
// ---------------------------------------------------------------------------

/**
 * Creates a JSON Forms renderer component for a given custom question type.
 *
 * @param formatName - The format string (e.g., "x-rating-stars")
 * @param CustomComponent - The author's React component
 */
export function createCustomQuestionTypeRenderer(
  formatName: string,
  CustomComponent: React.ComponentType<CustomQuestionTypeProps>,
): React.ComponentType {
  const AdapterInner: React.FC<ControlProps> = ({
    data,
    handleChange,
    path,
    schema,
    errors,
    enabled,
    label,
    description,
    required,
  }) => {
    // Build the simplified props for the custom component
    const hasErrors =
      errors && (Array.isArray(errors) ? errors.length > 0 : true);
    const errorMessage = hasErrors
      ? Array.isArray(errors)
        ? errors.map((e: any) => e.message || String(e)).join(', ')
        : String(errors)
      : '';

    // Extract all schema properties (except reserved ones) as config
    // This allows parameters alongside "format" to be passed to the renderer
    const schemaObj = schema as Record<string, unknown>;

    const RESERVED_PROPERTIES = new Set([
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

    // Extract all non-reserved properties as config
    const config: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schemaObj)) {
      if (!RESERVED_PROPERTIES.has(key) && !key.startsWith('$')) {
        config[key] = value;
      }
    }

    const jsonFormsContext = useJsonForms();

    // For ranking format: if people not in field schema, try to get from root schema
    if (schemaObj.format === 'ranking' && !config.people && jsonFormsContext?.core?.schema) {
      const rootSchema = jsonFormsContext.core.schema as Record<string, unknown>;
      const rootProperties = rootSchema.properties as Record<string, unknown> | undefined;
      if (rootProperties && path) {
        // Extract field name from path (e.g., "#/properties/ranking_field" -> "ranking_field")
        const fieldName = path.split('/').pop();
        if (fieldName && rootProperties[fieldName]) {
          const fieldSchema = rootProperties[fieldName] as Record<string, unknown>;
          if (fieldSchema.people) {
            config.people = fieldSchema.people;
          }
        }
      }
    }

    const customProps: CustomQuestionTypeProps = {
      value: data,
      config,
      onChange: (newValue: unknown) => handleChange(path, newValue),
      validation: {
        error: Boolean(hasErrors),
        message: errorMessage,
      },
      enabled: enabled ?? true,
      fieldPath: path,
      label: label ?? '',
      description: description,
      jsonFormsContext,
    };

    return (
      <QuestionShell
        title={label}
        description={description}
        required={required}
        error={errors}>
        <CustomQuestionErrorBoundary formatName={formatName}>
          <CustomComponent {...customProps} />
        </CustomQuestionErrorBoundary>
      </QuestionShell>
    );
  };

  AdapterInner.displayName = `CustomQuestionType(${formatName})`;

  // Wrap with JSON Forms HOC
  return withJsonFormsControlProps(AdapterInner);
}
