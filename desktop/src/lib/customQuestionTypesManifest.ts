/**
 * Candidate locations for custom question types and validators (Formulus parity).
 * Host code walks these with the bundle root and loads JS sources for `FormInitData`.
 */

export const CUSTOM_QUESTION_TYPE_DIR_CANDIDATES = [
  'question_types',
  'forms/question_types',
] as const;

export const VALIDATOR_DIR_CANDIDATES = [
  'validators',
  'forms/validators',
] as const;

export const CQT_RENDERER_FILES = ['renderer.js', 'index.js'] as const;
export const VALIDATOR_ENTRY = 'index.js' as const;
