import { ControlProps, JsonSchema7, UISchemaElement } from '@jsonforms/core';

type ControlUiNode = {
  type?: string;
  scope?: string;
  label?: string | boolean;
  elements?: UISchemaElement[];
  options?: { columns?: UISchemaElement[] };
};

function scopeToFieldKey(scope: string): string | null {
  const match = scope.match(/^#\/properties\/([^/]+)$/);
  return match?.[1] ?? null;
}

function walkUiControls(
  node: UISchemaElement | undefined,
  visit: (control: ControlUiNode) => void,
): void {
  if (!node || typeof node !== 'object') return;
  const obj = node as ControlUiNode;
  if (obj.type === 'Control' && typeof obj.scope === 'string') {
    visit(obj);
  }
  if (Array.isArray(obj.elements)) {
    for (const child of obj.elements) {
      walkUiControls(child, visit);
    }
  }
  const cols = obj.options?.columns;
  if (Array.isArray(cols)) {
    for (const col of cols) {
      walkUiControls(col, visit);
    }
  }
}

/** Build fieldKey → Control ui node index (first match wins). */
export function buildControlIndexByFieldKey(
  uischema: UISchemaElement | undefined,
): Map<string, ControlUiNode> {
  const index = new Map<string, ControlUiNode>();
  walkUiControls(uischema, control => {
    if (typeof control.scope !== 'string') return;
    const key = scopeToFieldKey(control.scope);
    if (key && !index.has(key)) {
      index.set(key, control);
    }
  });
  return index;
}

function labelFromControlAndSchema(
  control: ControlUiNode | undefined,
  fieldSchema: JsonSchema7 | undefined,
  fieldKey: string,
): string {
  if (
    control &&
    typeof control.label === 'string' &&
    control.label.length > 0
  ) {
    return control.label;
  }
  if (control && control.label === false) {
    return '';
  }
  const title = fieldSchema?.title;
  if (typeof title === 'string' && title.length > 0) {
    return title;
  }
  return fieldKey;
}

/**
 * Resolved display label for a Control renderer.
 * Prefer `uischema.label` (post-`applyFormUiTranslations`) over JsonForms
 * `props.label`, which often falls back to `schema.title` for the default locale.
 */
export function resolveControlLabel(props: ControlProps): string {
  const uischema = props.uischema as ControlUiNode | undefined;
  if (
    uischema &&
    typeof uischema.label === 'string' &&
    uischema.label.length > 0
  ) {
    return uischema.label;
  }
  if (uischema?.label === false) {
    return '';
  }
  const fromProps = props.label;
  if (typeof fromProps === 'string' && fromProps.length > 0) {
    return fromProps;
  }
  const schema = props.schema as JsonSchema7 | undefined;
  const title = schema?.title;
  if (typeof title === 'string' && title.length > 0) {
    return title;
  }
  return typeof fromProps === 'string' ? fromProps : '';
}

export function resolveControlDescription(
  props: ControlProps,
): string | undefined {
  const fromProps = props.description;
  if (typeof fromProps === 'string' && fromProps.length > 0) {
    return fromProps;
  }
  const schema = props.schema as JsonSchema7 | undefined;
  const desc = schema?.description;
  return typeof desc === 'string' && desc.length > 0 ? desc : undefined;
}

/**
 * Display label for a top-level field when ControlProps is unavailable
 * (header chips, finalize, errors).
 */
export function resolveFieldLabel(
  schema: JsonSchema7 | undefined,
  uischema: UISchemaElement | undefined,
  fieldKey: string,
  controlIndex?: Map<string, ControlUiNode>,
): string {
  const index = controlIndex ?? buildControlIndexByFieldKey(uischema);
  const control = index.get(fieldKey);
  const fieldSchema = schema?.properties?.[fieldKey] as JsonSchema7 | undefined;
  return labelFromControlAndSchema(control, fieldSchema, fieldKey);
}

export type LinkedFormSpec = {
  schema: JsonSchema7;
  uiSchema: UISchemaElement;
};

export type LinkedFormSpecsMap = Record<string, LinkedFormSpec>;
