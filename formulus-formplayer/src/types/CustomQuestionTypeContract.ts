/**
 * CustomQuestionTypeContract.ts
 *
 * Defines the public interface that custom question type renderers must follow.
 * Form authors create components that accept these props — no JSON Forms knowledge needed.
 *
 * Usage in JSON Schema:
 *   { "type": "number", "format": "x-rating-stars", "x-config": { "maxStars": 5 } }
 *
 * Usage in custom_app:
 *   custom_app/question_types/rating-stars/index.js
 *   export default function RatingStars({ value, config, onChange, validation }) { ... }
 */

/**
 * Props that every custom question type renderer receives.
 */
export interface CustomQuestionTypeProps {
  /** Current field value (type depends on the question's JSON schema type) */
  value: unknown;

  /**
   * Configuration from the schema's `x-config` property.
   * For example, if schema has `"x-config": { "maxStars": 5 }`,
   * then `config.maxStars === 5`.
   */
  config: Record<string, unknown>;

  /** Callback to update the field value. Call with the new value. */
  onChange: (newValue: unknown) => void;

  /** Current validation state for this field */
  validation: {
    /** Whether the field currently has a validation error */
    error: boolean;
    /** The validation error message (empty string if no error) */
    message: string;
  };

  /** Whether the field is currently enabled/editable */
  enabled: boolean;

  /** The field's unique path in the form data (e.g., "satisfaction") */
  fieldPath: string;

  /** Display label from the schema's `title` property */
  label: string;

  /** Optional description from the schema's `description` property */
  description?: string;
}

/**
 * Manifest passed from the native side describing available custom question types.
 * Each entry maps a format string to the source code of the module that renders it.
 * The RN side reads the JS file and passes the source string here for sandboxed evaluation.
 */
export interface CustomQuestionTypeManifest {
  custom_types: Record<
    string,
    {
      /** The JS source code of the module (read by RN via RNFS.readFile) */
      source: string;
    }
  >;
}

