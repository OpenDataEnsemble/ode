/**
 * CustomQuestionTypeContract.ts
 *
 * Defines the public interface that custom question type renderers must follow.
 * Form authors create components that accept these props — no JSON Forms knowledge needed.
 *
 * Usage in JSON Schema:
 *   { "type": "string", "format": "select-person", "showSearch": true, "people": [...] }
 *
 * Usage in custom_app:
 *   custom_app/question_types/select-person/index.js
 *   export default function SelectPerson({ value, config, onChange, validation }) {
 *     const people = config.people;       // custom property
 *     const showSearch = config.showSearch; // custom property
 *     ...
 *   }
 */

/**
 * Props that every custom question type renderer receives.
 */
export interface CustomQuestionTypeProps {
  /** Current field value (type depends on the question's JSON schema type) */
  value: unknown;

  /**
   * The full JSON Schema object for this field, exposed as `config`.
   * Custom properties live directly on the schema — access them like
   * `config.people`, `config.showSearch`, `config.query`, etc.
   * Standard keys like `type`, `format`, `title` are also available.
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

  /** The field's unique path in the form data (e.g., "ranking_field") */
  fieldPath: string;

  /** Display label from the schema's `title` property */
  label: string;

  /** Optional description from the schema's `description` property */
  description?: string;
}

/**
 * Manifest passed from the native side describing available custom question types.
 * Each entry maps a format string to the path of the module that renders it.
 */
export interface CustomQuestionTypeManifest {
  custom_types: Record<
    string,
    {
      /** Path to the JS module (e.g., "file:///path/to/question_types/ranking/index.js") */
      modulePath: string;
    }
  >;
}
