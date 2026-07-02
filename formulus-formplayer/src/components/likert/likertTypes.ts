import type { JsonSchema7 } from '@jsonforms/core';
import type { ChoiceLayout } from '../../theme/choiceLayout';

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

/** Single scale option in schema `oneOf` (emoji is display-only metadata). */
export interface LikertOneOfEntry {
  const: string | number;
  title?: string;
  emoji?: string;
}

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
  layout: ChoiceLayout;
}

/** JSON Schema field with Likert extension (formplayer built-in). */
export type LikertJsonSchema = JsonSchema7 & {
  format: 'likert';
  likert?: LikertConfig;
  oneOf?: LikertOneOfEntry[];
};

/** Object wrapper schema for Storybook / tests with a Likert property. */
export type LikertObjectJsonSchema = JsonSchema7 & {
  type: 'object';
  properties: Record<string, LikertJsonSchema | JsonSchema7>;
  required?: string[];
};
