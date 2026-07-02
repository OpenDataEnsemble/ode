import type { LikertOption, LikertPreset } from './likertTypes';

export const LIKERT_PRESET_OPTIONS: Record<LikertPreset, LikertOption[]> = {
  agreement: [
    { value: 1, label: 'Strongly disagree' },
    { value: 2, label: 'Disagree' },
    { value: 3, label: 'Neutral' },
    { value: 4, label: 'Agree' },
    { value: 5, label: 'Strongly agree' },
  ],
  frequency: [
    { value: 1, label: 'Never' },
    { value: 2, label: 'Rarely' },
    { value: 3, label: 'Sometimes' },
    { value: 4, label: 'Often' },
    { value: 5, label: 'Always' },
  ],
  satisfaction: [
    { value: 1, label: 'Very dissatisfied' },
    { value: 2, label: 'Dissatisfied' },
    { value: 3, label: 'Neutral' },
    { value: 4, label: 'Satisfied' },
    { value: 5, label: 'Very satisfied' },
  ],
  importance: [
    { value: 1, label: 'Not important' },
    { value: 2, label: 'Slightly important' },
    { value: 3, label: 'Moderately important' },
    { value: 4, label: 'Important' },
    { value: 5, label: 'Very important' },
  ],
  likelihood: [
    { value: 1, label: 'Very unlikely' },
    { value: 2, label: 'Unlikely' },
    { value: 3, label: 'Neutral' },
    { value: 4, label: 'Likely' },
    { value: 5, label: 'Very likely' },
  ],
  numeric_0_10: Array.from({ length: 11 }, (_, i) => ({
    value: i,
    label: String(i),
  })),
  numeric_1_5: Array.from({ length: 5 }, (_, i) => ({
    value: i + 1,
    label: String(i + 1),
  })),
  numeric_1_7: Array.from({ length: 7 }, (_, i) => ({
    value: i + 1,
    label: String(i + 1),
  })),
};

export function getPresetOptions(preset: LikertPreset): LikertOption[] {
  return LIKERT_PRESET_OPTIONS[preset].map(o => ({ ...o }));
}
