export type LikertPreset =
  | 'agreement'
  | 'frequency'
  | 'satisfaction'
  | 'importance'
  | 'likelihood'
  | 'numeric_0_10'
  | 'numeric_1_5'
  | 'numeric_1_7';

export type LikertDisplay =
  | 'buttons'
  | 'radio'
  | 'slider'
  | 'numeric'
  | 'stars'
  | 'emoji';

export type LikertColorMode = 'neutral' | 'spectrum' | 'stars';

export interface LikertOption {
  value: string | number;
  label: string;
  emoji?: string;
}

export interface LikertConfig {
  preset?: LikertPreset;
  display?: LikertDisplay;
  colorMode?: LikertColorMode;
  endpointLabelsOnly?: boolean;
  allowClear?: boolean;
  allowNotApplicable?: boolean;
  notApplicableLabel?: string;
  notApplicableValue?: null | string | number;
}

export interface ResolvedLikertOptions {
  options: LikertOption[];
  display: LikertDisplay;
  colorMode: LikertColorMode;
  endpointLabelsOnly: boolean;
  allowClear: boolean;
  allowNotApplicable: boolean;
  notApplicableLabel: string;
  notApplicableValue: null | string | number;
  orientation: 'horizontal' | 'vertical';
}

/** JSON Schema field with optional Likert extension (formplayer built-in). */
export type LikertJsonSchema = import('@jsonforms/core').JsonSchema7 & {
  likert?: LikertConfig;
};
