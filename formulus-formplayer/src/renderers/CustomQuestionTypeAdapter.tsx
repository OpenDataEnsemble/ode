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
            padding: '12px',
            border: '1px solid #f44336',
            borderRadius: '4px',
            backgroundColor: '#fce4ec',
            color: '#c62828',
          }}>
          <strong>Custom question type "{this.props.formatName}" failed</strong>
          <br />
          <small>{this.state.error?.message}</small>
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
