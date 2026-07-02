import type {
  LikertConfig,
  LikertJsonSchema,
  LikertObjectJsonSchema,
  LikertOneOfEntry,
} from './likertTypes';

export function likertField(
  oneOf: LikertOneOfEntry[],
  options: {
    title?: string;
    type?: 'integer' | ['integer', 'null'];
    likert?: LikertConfig;
  } = {},
): LikertJsonSchema {
  return {
    type: options.type ?? 'integer',
    format: 'likert',
    title: options.title ?? 'Question',
    oneOf,
    ...(options.likert ? { likert: options.likert } : {}),
  };
}

export function likertPresetField(
  preset: NonNullable<LikertConfig['preset']>,
  options: {
    title?: string;
    likert?: Omit<LikertConfig, 'preset'>;
  } = {},
): LikertJsonSchema {
  return {
    type: 'integer',
    format: 'likert',
    title: options.title ?? 'Question',
    likert: { preset, ...options.likert },
  };
}

export function likertObjectSchema(
  field: LikertJsonSchema,
  fieldName = 'satisfaction',
  required?: string[],
): LikertObjectJsonSchema {
  return {
    type: 'object',
    properties: { [fieldName]: field },
    ...(required?.length ? { required } : {}),
  };
}
